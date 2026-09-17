import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser, Region, UserRole } from '../common/access.types';

@Injectable()
export class ScopeService {
  resolve(user: AuthenticatedUser, requestedRegion?: string): Region | null {
    const requested = !requestedRegion || requestedRegion === 'ALL' ? null : this.toRegion(requestedRegion);

    if (user.role === UserRole.ADMIN) return requested;
    if (!user.region) throw new ForbiddenException('Manager has no assigned region');
    if (requested && requested !== user.region) {
      throw new ForbiddenException('You cannot access another region');
    }
    return user.region;
  }

  availableRegions(user: AuthenticatedUser): Region[] {
    if (user.role === UserRole.ADMIN) return Object.values(Region);
    return user.region ? [user.region] : [];
  }

  private toRegion(value: string): Region {
    const region = Object.values(Region).find((candidate) => candidate === value);
    if (!region) throw new BadRequestException('Unknown region');
    return region;
  }
}

