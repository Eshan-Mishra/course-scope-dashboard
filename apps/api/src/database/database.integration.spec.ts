jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

import { Region, UserRole } from '@course-scope/contracts';
import { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ACCESS_COOKIE, JWT_AUDIENCE, JWT_ISSUER } from '../auth/auth.constants';
import { AuthService, RequestContext } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import { ScopeService } from '../analytics/scope.service';
import { PrismaService } from './database.module';
import { seedDatabase } from './seed';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('database migration and seed integration', () => {
  let prisma: PrismaClient;
  let auth: AuthService;
  let jwt: JwtService;
  const context: RequestContext = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname.slice(1);
    if (!databaseName.endsWith('_test')) throw new Error('TEST_DATABASE_URL must target a database ending in _test');

    const resetClient = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await resetClient.$executeRawUnsafe('DROP SCHEMA public CASCADE');
    await resetClient.$executeRawUnsafe('CREATE SCHEMA public');
    await resetClient.$disconnect();

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: resolve(__dirname, '../..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await seedDatabase(prisma);
    await seedDatabase(prisma);
    jwt = new JwtService({
      secret: 'integration-test-secret',
      signOptions: { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithm: 'HS256', expiresIn: '15m' },
      verifyOptions: { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithms: ['HS256'] },
    });
    auth = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      {
        get: (key: string) => (key === 'NODE_ENV' ? 'test' : undefined),
      } as unknown as ConfigService,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('creates the schema and keeps the seed repeatable', async () => {
    await expect(prisma.course.count()).resolves.toBe(12);
    await expect(prisma.student.count()).resolves.toBe(50);
    await expect(prisma.enrollment.count()).resolves.toBe(119);
    await expect(prisma.user.count()).resolves.toBe(3);
  });

  it('produces the expected all-region revenue total', async () => {
    const result = await prisma.enrollment.aggregate({ _sum: { feePaid: true } });
    expect(result._sum.feePaid).toBe(734800);

    const dashboard = await new AnalyticsService(prisma as unknown as PrismaService, new ScopeService()).dashboard({
      sub: '00000000-0000-4000-8000-000000000000',
      email: 'admin@coursescope.test',
      role: UserRole.ADMIN,
      region: null,
    });
    expect(dashboard.regionalPerformance).toEqual([
      { region: Region.EAST, revenue: 121800, learners: 10, revenuePerLearner: 12180, completionRate: 63.6 },
      { region: Region.NORTH, revenue: 353250, learners: 22, revenuePerLearner: 16057, completionRate: 50.9 },
      { region: Region.SOUTH, revenue: 259750, learners: 18, revenuePerLearner: 14431, completionRate: 59.5 },
    ]);
  });

  it('uses current database permissions and rejects an access token after logout', async () => {
    const login = await auth.login('admin@coursescope.test', 'Demo@123', context);
    const guard = new JwtAuthGuard(jwt, prisma as unknown as PrismaService);
    const request: { cookies: Record<string, string>; user?: { role: string; region: string | null } } = {
      cookies: { [ACCESS_COOKIE]: login.accessToken },
    };
    const execution = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

    await prisma.user.update({
      where: { email: 'admin@coursescope.test' },
      data: { role: UserRole.MANAGER, region: Region.NORTH },
    });
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.user).toMatchObject({ role: 'manager', region: 'North' });

    await auth.logout(login.refreshToken, login.accessToken, context);
    await expect(guard.canActivate(execution)).rejects.toThrow('Session expired');
    await prisma.user.update({
      where: { email: 'admin@coursescope.test' },
      data: { role: UserRole.ADMIN, region: null },
    });
  });

  it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
    const login = await auth.login('north@coursescope.test', 'Demo@123', context);
    const rotated = await auth.refresh(login.refreshToken, context);

    await expect(auth.refresh(login.refreshToken, context)).rejects.toThrow('Session expired');
    await expect(auth.refresh(rotated.refreshToken, context)).rejects.toThrow('Session expired');

    const concurrentLogin = await auth.login('admin@coursescope.test', 'Demo@123', context);
    const concurrentRefreshes = await Promise.allSettled([
      auth.refresh(concurrentLogin.refreshToken, context),
      auth.refresh(concurrentLogin.refreshToken, context),
    ]);
    expect(concurrentRefreshes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const winner = concurrentRefreshes.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<AuthService['refresh']>>> => result.status === 'fulfilled',
    );
    await expect(auth.refresh(winner!.value.refreshToken, context)).rejects.toThrow('Session expired');
  });

  it('locks repeated password failures and password reset revokes existing sessions', async () => {
    const login = await auth.login('south@coursescope.test', 'Demo@123', context);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(auth.login(login.user.email, 'wrong-password', context)).rejects.toThrow(
        'Invalid email or password',
      );
    }
    await expect(auth.login(login.user.email, 'Demo@123', context)).rejects.toThrow(
      'Too many login attempts',
    );

    const reset = (await auth.requestPasswordReset(login.user.email, context)) as {
      accepted: boolean;
      developmentToken?: string;
    };
    expect(reset.developmentToken).toBeDefined();
    const resetAttempts = await Promise.allSettled([
      auth.confirmPasswordReset(reset.developmentToken!, 'NewDemoPassword@123', context),
      auth.confirmPasswordReset(reset.developmentToken!, 'OtherDemoPassword@123', context),
    ]);
    expect(resetAttempts.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    await expect(auth.refresh(login.refreshToken, context)).rejects.toThrow('Session expired');
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: login.user.sub } });
    const passwordMatches = await Promise.all([
      compare('NewDemoPassword@123', updated.passwordHash),
      compare('OtherDemoPassword@123', updated.passwordHash),
    ]);
    expect(passwordMatches.filter(Boolean)).toHaveLength(1);
  });
});
