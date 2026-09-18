import { AuthenticatedUser, UserRole } from '@course-scope/contracts';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { PrismaService } from '../database/database.module';
import {
  ACCOUNT_LOCK_ATTEMPTS,
  ACCOUNT_LOCK_MS,
  LOGIN_RATE_LIMIT,
  LOGIN_WINDOW_MS,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import { validateAccessClaims } from './jwt-auth.guard';

const DUMMY_PASSWORD_HASH = '$2b$10$ZCwR9FuX620Q7ruKL9i4LOZrdSueOWIDhnnX4iwJaHmoiE1Lr564C';

export type RequestContext = { ipAddress: string | null; userAgent: string | null };

type SessionResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
};

@Injectable()
export class AuthService {
  private readonly mfaKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.mfaKey = createHash('sha256').update(this.config.getOrThrow<string>('MFA_ENCRYPTION_KEY')).digest();
  }

  async login(email: string, password: string, mfaCode: string | undefined, context: RequestContext): Promise<SessionResult> {
    const normalizedEmail = email.toLowerCase();
    await this.assertLoginRateLimit(normalizedEmail, context);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit('login_locked', context, user.id, normalizedEmail);
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const passwordValid = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordValid) {
      const locked = user ? await this.recordFailedLogin(user) : false;
      await this.audit('login_failed', context, user?.id, normalizedEmail);
      if (locked && user) await this.audit('account_locked', context, user.id, normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.mfaEnabled && (!mfaCode || !this.verifyMfa(user, mfaCode))) {
      const locked = await this.recordFailedLogin(user);
      await this.audit('mfa_failed', context, user.id, normalizedEmail);
      if (locked) await this.audit('account_locked', context, user.id, normalizedEmail, { factor: 'mfa' });
      throw new UnauthorizedException('MFA code required or invalid');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const result = await this.createSession(user, context);
    await this.audit('login_succeeded', context, user.id, normalizedEmail);
    return result;
  }

  async refresh(refreshToken: string | undefined, context: RequestContext): Promise<SessionResult> {
    const sessionId = this.refreshSessionId(refreshToken);
    const session = sessionId
      ? await this.prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: true } })
      : null;
    const now = new Date();

    if (!session || !refreshToken || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException('Session expired');
    }

    if (!this.hashMatches(refreshToken, session.refreshTokenHash)) {
      await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: now } });
      await this.audit('refresh_reuse_detected', context, session.userId, session.user.email);
      throw new UnauthorizedException('Session expired');
    }

    const nextRefreshToken = this.newRefreshToken(session.id);
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null, expiresAt: { gt: now } },
      data: {
        refreshTokenHash: this.tokenHash(nextRefreshToken),
        lastUsedAt: now,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    if (rotated.count !== 1) {
      await this.prisma.authSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
      await this.audit('refresh_reuse_detected', context, session.userId, session.user.email);
      throw new UnauthorizedException('Session expired');
    }

    await this.audit('refresh_rotated', context, session.userId, session.user.email);
    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      refreshToken: nextRefreshToken,
      user: this.sessionUser(session.user),
    };
  }

  async logout(refreshToken: string | undefined, accessToken: string | undefined, context: RequestContext): Promise<void> {
    const sessionId = this.refreshSessionId(refreshToken);
    let session = sessionId
      ? await this.prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: true } })
      : null;
    if (session && refreshToken && !this.hashMatches(refreshToken, session.refreshTokenHash)) session = null;

    if (!session && accessToken) {
      try {
        const claims = validateAccessClaims(
          await this.jwt.verifyAsync<Record<string, unknown>>(accessToken, { ignoreExpiration: true }),
        );
        session = await this.prisma.authSession.findUnique({ where: { id: claims.sid }, include: { user: true } });
        if (session?.userId !== claims.sub) session = null;
      } catch {
        session = null;
      }
    }
    if (!session || session.revokedAt) return;

    await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await this.audit('logout_revoked', context, session.userId, session.user.email);
  }

  async requestPasswordReset(email: string, context: RequestContext) {
    const normalizedEmail = email.toLowerCase();
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const webhook = this.config.get<string>('PASSWORD_RESET_WEBHOOK_URL');
    if (production && !webhook) throw new ServiceUnavailableException('Password reset delivery is not configured');

    const recent = await this.prisma.authAuditLog.count({
      where: {
        email: normalizedEmail,
        ipAddress: context.ipAddress,
        event: 'password_reset_requested',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recent >= 5) return { accepted: true };

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    await this.audit('password_reset_requested', context, user?.id, normalizedEmail);
    if (!user) return { accepted: true };

    const token = randomBytes(48).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: this.tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      }),
    ]);

    if (webhook) {
      try {
        await this.deliverReset(webhook, normalizedEmail, token);
      } catch (error) {
        await this.prisma.passwordResetToken.deleteMany({ where: { tokenHash: this.tokenHash(token) } });
        throw error;
      }
    }
    return { accepted: true, ...(production ? {} : { developmentToken: token }) };
  }

  async confirmPasswordReset(token: string, newPassword: string, context: RequestContext): Promise<void> {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokenHash(token) },
      include: { user: true },
    });
    const now = new Date();
    if (!reset || reset.usedAt || reset.expiresAt <= now) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await hash(newPassword, 12);
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw new BadRequestException('Invalid or expired reset token');

      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash, passwordChangedAt: now, failedLoginAttempts: 0, lockedUntil: null },
      });
      await transaction.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.authAuditLog.create({
        data: {
          event: 'password_reset_completed',
          userId: reset.userId,
          email: reset.user.email,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });
  }

  async setupMfa(user: AuthenticatedUser, password: string, context: RequestContext) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    if (current.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    if (!(await compare(password, current.passwordHash))) {
      await this.audit('mfa_setup_reauth_failed', context, current.id, current.email);
      throw new UnauthorizedException('Password confirmation failed');
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = this.totp(current.email, secret.base32);
    await this.prisma.user.update({
      where: { id: current.id },
      data: { mfaSecretEncrypted: this.encrypt(secret.base32), mfaEnabled: false },
    });
    await this.audit('mfa_setup_started', context, current.id, current.email);
    return { manualKey: secret.base32, otpauthUrl: totp.toString() };
  }

  async confirmMfa(user: AuthenticatedUser, code: string, context: RequestContext): Promise<void> {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    if (!current.mfaSecretEncrypted || !this.verifyMfa(current, code)) throw new BadRequestException('Invalid MFA code');

    await this.prisma.user.update({ where: { id: current.id }, data: { mfaEnabled: true } });
    await this.audit('mfa_enabled', context, current.id, current.email);
  }

  async auditLogs(user: AuthenticatedUser, limit: number) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin access required');
    return this.prisma.authAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100) });
  }

  private async createSession(user: User, context: RequestContext): Promise<SessionResult> {
    const sessionId = randomUUID();
    const refreshToken = this.newRefreshToken(sessionId);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return {
      accessToken: await this.signAccessToken(user, sessionId),
      refreshToken,
      user: this.sessionUser(user),
    };
  }

  private async signAccessToken(user: User, sessionId: string): Promise<string> {
    return this.jwt.signAsync({ ...this.sessionUser(user), sid: sessionId, tokenType: 'access' });
  }

  private sessionUser(user: User): AuthenticatedUser {
    return { sub: user.id, email: user.email, role: user.role, region: user.region };
  }

  private async assertLoginRateLimit(email: string, context: RequestContext): Promise<void> {
    const failures = await this.prisma.authAuditLog.count({
      where: {
        email,
        ipAddress: context.ipAddress,
        event: { in: ['login_failed', 'mfa_failed'] },
        createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) },
      },
    });
    if (failures < LOGIN_RATE_LIMIT) return;
    await this.audit('login_rate_limited', context, undefined, email);
    throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async recordFailedLogin(user: User): Promise<boolean> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    if (updated.failedLoginAttempts < ACCOUNT_LOCK_ATTEMPTS) return false;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) },
    });
    return true;
  }

  private async audit(
    event: string,
    context: RequestContext,
    userId?: string,
    email?: string,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.authAuditLog.create({
      data: {
        event,
        userId,
        email,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details,
      },
    });
  }

  private newRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(48).toString('base64url')}`;
  }

  private refreshSessionId(token: string | undefined): string | null {
    if (!token) return null;
    const [sessionId, secret, extra] = token.split('.');
    return !extra && /^[0-9a-f-]{36}$/i.test(sessionId) && secret?.length >= 64 ? sessionId : null;
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashMatches(token: string, expected: string): boolean {
    const actual = Buffer.from(this.tokenHash(token));
    const stored = Buffer.from(expected.trim());
    return actual.length === stored.length && timingSafeEqual(actual, stored);
  }

  private totp(email: string, base32Secret: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: 'CourseScope',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    });
  }

  private verifyMfa(user: User, code: string): boolean {
    if (!user.mfaSecretEncrypted) return false;
    return this.totp(user.email, this.decrypt(user.mfaSecretEncrypted)).validate({ token: code, window: 1 }) !== null;
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.mfaKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(value: string): string {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted MFA secret');
    const decipher = createDecipheriv('aes-256-gcm', this.mfaKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private async deliverReset(webhook: string, email: string, token: string): Promise<void> {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.get<string>('PASSWORD_RESET_WEBHOOK_SECRET')
          ? { Authorization: `Bearer ${this.config.get<string>('PASSWORD_RESET_WEBHOOK_SECRET')}` }
          : {}),
      },
      body: JSON.stringify({ email, token }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Password reset delivery failed');
  }
}
