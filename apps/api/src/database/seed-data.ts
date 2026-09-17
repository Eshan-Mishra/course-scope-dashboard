import { Region, UserRole } from '@course-scope/contracts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Course } from './entities/course.entity';
import { CompletionStatus, Enrollment } from './entities/enrollment.entity';
import { Student } from './entities/student.entity';
import { User } from './entities/user.entity';

type SourceData = {
  courses: Array<{
    id: string;
    title: string;
    category: string;
    level: string;
    instructor: string;
    duration_weeks: number;
  }>;
  students: Array<{
    id: string;
    name: string;
    region: Region;
    joined_on: string;
    enrollments: Array<{
      course_id: string;
      enrolled_on: string;
      completion_status: CompletionStatus;
      grade: string | null;
      rating: number;
      fee_paid: number;
    }>;
  }>;
};

export type SeedSummary = {
  courses: number;
  students: number;
  enrollments: number;
};

export async function seedDatabase(dataSource: DataSource, sourcePath?: string): Promise<SeedSummary> {
  const filePath = sourcePath ?? process.env.SOURCE_DATA_PATH ?? resolve(__dirname, '../../../../data/data.json');
  const source = JSON.parse(await readFile(filePath, 'utf8')) as SourceData;
  const enrollments = source.students.flatMap((student) =>
    student.enrollments.map((enrollment) => ({
      studentId: student.id,
      courseId: enrollment.course_id,
      enrolledOn: enrollment.enrolled_on,
      completionStatus: enrollment.completion_status,
      grade: enrollment.grade,
      rating: enrollment.rating,
      feePaid: enrollment.fee_paid,
    })),
  );

  await dataSource.transaction(async (manager) => {
    await manager.upsert(
      Course,
      source.courses.map((course) => ({
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level,
        instructor: course.instructor,
        durationWeeks: course.duration_weeks,
      })),
      ['id'],
    );
    await manager.upsert(
      Student,
      source.students.map((student) => ({
        id: student.id,
        name: student.name,
        region: student.region,
        joinedOn: student.joined_on,
      })),
      ['id'],
    );
    await manager.upsert(Enrollment, enrollments, ['studentId', 'courseId']);

    const passwordHash = await hash('Demo@123', 10);
    await manager.upsert(
      User,
      [
        { email: 'admin@coursescope.test', passwordHash, role: UserRole.ADMIN, region: null },
        { email: 'north@coursescope.test', passwordHash, role: UserRole.MANAGER, region: Region.NORTH },
        { email: 'south@coursescope.test', passwordHash, role: UserRole.MANAGER, region: Region.SOUTH },
      ],
      ['email'],
    );
  });

  return {
    courses: source.courses.length,
    students: source.students.length,
    enrollments: enrollments.length,
  };
}
