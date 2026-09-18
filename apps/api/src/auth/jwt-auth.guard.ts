import { AuthenticatedUser, Region, UserRole } from '@course-scope/contracts';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../database/database.module';
import { ACCESS_COOKIE, JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';

type AccessClaims = AuthenticatedUser & {
  sid: string;
  tokenType: 'access';
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
};

export function validateAccessClaims(value: unknown): AccessClaims {
  if (!value || typeof value !== 'object') throw new UnauthorizedException('Invalid session');
  const claims = value as Record<string, unknown>;
  const roleValid = Object.values(UserRole).includes(claims.role as UserRole);
  const regionValid = claims.region === null || Object.values(Region).includes(claims.region as Region);
  const roleScopeValid =
    (claims.role === UserRole.ADMIN && claims.region === null) ||
    (claims.role === UserRole.MANAGER && typeof claims.region === 'string' && regionValid);
  const audienceValid =
    claims.aud === JWT_AUDIENCE || (Array.isArray(claims.aud) && claims.aud.includes(JWT_AUDIENCE));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    typeof claims.sub !== 'string' ||
    !uuid.test(claims.sub) ||
    typeof claims.sid !== 'string' ||
    !uuid.test(claims.sid) ||
    typeof claims.email !== 'string' ||
    !email.test(claims.email) ||
    claims.tokenType !== 'access' ||
    claims.iss !== JWT_ISSUER ||
    !audienceValid ||
    typeof claims.iat !== 'number' ||
    typeof claims.exp !== 'number' ||
    !roleValid ||
    !regionValid ||
    !roleScopeValid
  ) {
    throw new UnauthorizedException('Invalid session');
  }
  return claims as AccessClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>() as Request & { user?: AuthenticatedUser };
    const token = request.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Login required');

    try {
      const claims = validateAccessClaims(await this.jwt.verifyAsync<Record<string, unknown>>(token));
      const session = await this.prisma.authSession.findUnique({ where: { id: claims.sid }, include: { user: true } });
      if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session expired');
      }

      request.user = {
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role,
        region: session.user.region,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }
}
