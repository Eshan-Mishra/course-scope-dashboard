import { AuthenticatedUser, DashboardData, Region } from '@course-scope/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
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
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly scope: ScopeService,
  ) {}

  async dashboard(user: AuthenticatedUser, requestedRegion?: string): Promise<DashboardData> {
    const effectiveRegion = this.scope.resolve(user, requestedRegion);
    const [categories, summary] = await Promise.all([
      this.categoryQuery(effectiveRegion).getRawMany<CategoryRow>(),
      this.summaryQuery(effectiveRegion).getRawOne<SummaryRow>(),
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

  private baseQuery(region: Region | null): SelectQueryBuilder<Enrollment> {
    const query = this.enrollments
      .createQueryBuilder('enrollment')
      .innerJoin('enrollment.course', 'course')
      .innerJoin('enrollment.student', 'student');
    if (region) query.andWhere('student.region = :region', { region });
    return query;
  }

  private categoryQuery(region: Region | null) {
    return this.baseQuery(region)
      .select('course.category', 'category')
      .addSelect('SUM(enrollment.fee_paid)', 'revenue')
      .addSelect('COUNT(*)', 'enrollments')
      .addSelect(`COUNT(*) FILTER (WHERE enrollment.completion_status = 'completed')`, 'completed')
      .addSelect(`COUNT(*) FILTER (WHERE enrollment.completion_status = 'dropped')`, 'dropped')
      .addSelect('ROUND(AVG(enrollment.rating), 2)', 'averageRating')
      .groupBy('course.category')
      .orderBy('course.category', 'ASC');
  }

  private summaryQuery(region: Region | null) {
    return this.baseQuery(region)
      .select('COALESCE(SUM(enrollment.fee_paid), 0)', 'revenue')
      .addSelect('COUNT(*)', 'enrollments')
      .addSelect('COUNT(DISTINCT enrollment.student_id)', 'learners')
      .addSelect(`COUNT(*) FILTER (WHERE enrollment.completion_status = 'completed')`, 'completed')
      .addSelect('COALESCE(ROUND(AVG(enrollment.rating), 2), 0)', 'averageRating');
  }

  private percent(numerator: string, denominator: string): number {
    const total = Number(denominator);
    return total ? Math.round((Number(numerator) / total) * 1000) / 10 : 0;
  }
}
