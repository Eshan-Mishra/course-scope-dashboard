import { Region, UserRole } from '@course-scope/contracts';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';
import { requireTrustedOrigin } from './csrf.middleware';
import { validateAccessClaims } from './jwt-auth.guard';

describe('authentication boundaries', () => {
  const validClaims = {
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'north@test.local',
    role: UserRole.MANAGER,
    region: Region.NORTH,
    tokenType: 'access',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: 1,
    exp: 2,
  } as const;

  it('runtime-validates issuer, audience, role, region, and role-scope consistency', () => {
    expect(validateAccessClaims(validClaims)).toMatchObject(validClaims);
    expect(() => validateAccessClaims({ ...validClaims, iss: 'attacker' })).toThrow('Invalid session');
    expect(() => validateAccessClaims({ ...validClaims, role: 'owner' })).toThrow('Invalid session');
    expect(() => validateAccessClaims({ ...validClaims, region: null })).toThrow('Invalid session');
  });

  it('allows safe requests and blocks unsafe requests from another origin', () => {
    const middleware = requireTrustedOrigin('http://localhost:3000');
    const next = jest.fn();
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    middleware({ method: 'GET', get: jest.fn() } as never, response as never, next);
    expect(next).toHaveBeenCalledTimes(1);

    middleware(
      { method: 'POST', get: jest.fn().mockReturnValue('https://evil.example') } as never,
      response as never,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: 'Invalid request origin' });
  });
});
