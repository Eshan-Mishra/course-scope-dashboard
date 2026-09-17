export const UserRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Region = {
  EAST: 'East',
  NORTH: 'North',
  SOUTH: 'South',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: UserRole;
  region: Region | null;
};

export type CategoryHealth = {
  category: string;
  revenue: number;
  enrollments: number;
  completionRate: number;
  dropRate: number;
  averageRating: number;
};

export type DashboardData = {
  scope: Region | 'ALL';
  availableRegions: Region[];
  revenueByCategory: Array<{ category: string; revenue: number }>;
  categoryHealth: CategoryHealth[];
  summary: {
    revenue: number;
    enrollments: number;
    learners: number;
    completionRate: number;
    averageRating: number;
  };
};
