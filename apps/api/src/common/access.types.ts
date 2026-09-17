export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export enum Region {
  EAST = 'East',
  NORTH = 'North',
  SOUTH = 'South',
}

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: UserRole;
  region: Region | null;
};

