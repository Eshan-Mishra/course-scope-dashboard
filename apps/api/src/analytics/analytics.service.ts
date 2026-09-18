import { AuthenticatedUser, DashboardData, Region } from '@course-scope/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.module';
import { ScopeService } from './scope.service';

type CategoryRow = {
  category: string;
  revenue: string;
  enrollments: string;
  completed: string;
  dropped: string;
  averageRating: string;
};

type SummaryRow = {
  revenue: string;
  enrollments: string;
  learners: string;
  completed: string;
  averageRating: string;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async dashboard(user: AuthenticatedUser, requestedRegion?: string): Promise<DashboardData> {
    const effectiveRegion = this.scope.resolve(user, requestedRegion);
    const [categories, summary] = await Promise.all([
      this.categoryQuery(effectiveRegion),
      this.summaryQuery(effectiveRegion),
    ]);

    const categoryHealth = categories.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue),
      enrollments: Number(row.enrollments),
      completionRate: this.percent(row.completed, row.enrollments),
      dropRate: this.percent(row.dropped, row.enrollments),
      averageRating: Number(row.averageRating),
    }));

    return {
      scope: effectiveRegion ?? 'ALL',
      availableRegions: this.scope.availableRegions(user),
      revenueByCategory: categoryHealth.map(({ category, revenue }) => ({ category, revenue })),
      categoryHealth,
      summary: {
        revenue: Number(summary?.revenue ?? 0),
        enrollments: Number(summary?.enrollments ?? 0),
        learners: Number(summary?.learners ?? 0),
        completionRate: this.percent(summary?.completed ?? '0', summary?.enrollments ?? '0'),
        averageRating: Number(summary?.averageRating ?? 0),
      },
    };
  }

  private categoryQuery(region: Region | null): Promise<CategoryRow[]> {
    const filter = region ? Prisma.sql`WHERE student.region = ${region}::"Region"` : Prisma.empty;
    return this.prisma.$queryRaw<CategoryRow[]>(Prisma.sql`
      SELECT course.category,
        SUM(enrollment.fee_paid)::text AS revenue,
        COUNT(*)::text AS enrollments,
        COUNT(*) FILTER (WHERE enrollment.completion_status = 'completed')::text AS completed,
        COUNT(*) FILTER (WHERE enrollment.completion_status = 'dropped')::text AS dropped,
        ROUND(AVG(enrollment.rating), 2)::text AS "averageRating"
      FROM enrollments enrollment
      JOIN courses course ON course.id = enrollment.course_id
      JOIN students student ON student.id = enrollment.student_id
      ${filter}
      GROUP BY course.category
      ORDER BY course.category
    `);
  }

  private async summaryQuery(region: Region | null): Promise<SummaryRow | null> {
    const filter = region ? Prisma.sql`WHERE student.region = ${region}::"Region"` : Prisma.empty;
    const [row] = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT COALESCE(SUM(enrollment.fee_paid), 0)::text AS revenue,
        COUNT(*)::text AS enrollments,
        COUNT(DISTINCT enrollment.student_id)::text AS learners,
        COUNT(*) FILTER (WHERE enrollment.completion_status = 'completed')::text AS completed,
        COALESCE(ROUND(AVG(enrollment.rating), 2), 0)::text AS "averageRating"
      FROM enrollments enrollment
      JOIN students student ON student.id = enrollment.student_id
      ${filter}
    `);
    return row ?? null;
  }

  private percent(numerator: string, denominator: string): number {
    const total = Number(denominator);
    return total ? Math.round((Number(numerator) / total) * 1000) / 10 : 0;
  }
}
