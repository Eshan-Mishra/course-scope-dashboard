import { AuthenticatedUser, Region, UserRole } from '@course-scope/contracts';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ScopeService } from './scope.service';

const admin: AuthenticatedUser = { sub: '1', email: 'admin@test', role: UserRole.ADMIN, region: null };
const northManager: AuthenticatedUser = { sub: '2', email: 'north@test', role: UserRole.MANAGER, region: Region.NORTH };

describe('ScopeService', () => {
  const service = new ScopeService();

  it('allows an admin to view all regions', () => {
    expect(service.resolve(admin)).toBeNull();
  });

  it('allows an admin to choose one valid region', () => {
    expect(service.resolve(admin, Region.SOUTH)).toBe(Region.SOUTH);
  });

  it('always scopes a manager to their assigned region', () => {
    expect(service.resolve(northManager)).toBe(Region.NORTH);
    expect(service.resolve(northManager, Region.NORTH)).toBe(Region.NORTH);
  });

  it('blocks a manager from requesting another region directly', () => {
    expect(() => service.resolve(northManager, Region.SOUTH)).toThrow(ForbiddenException);
  });

  it('rejects unknown regions instead of silently broadening access', () => {
    expect(() => service.resolve(admin, 'Everywhere')).toThrow(BadRequestException);
  });
});
