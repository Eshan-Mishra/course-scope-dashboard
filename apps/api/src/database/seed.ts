import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash } from 'bcryptjs';
import AppDataSource from './data-source';
import { Region, UserRole } from '../common/access.types';
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

async function seed(): Promise<void> {
  const filePath = process.env.SOURCE_DATA_PATH ?? resolve(__dirname, '../../../../data/data.json');
  const source = JSON.parse(await readFile(filePath, 'utf8')) as SourceData;
  await AppDataSource.initialize();

  await AppDataSource.transaction(async (manager) => {
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
    await manager.upsert(
      Enrollment,
      source.students.flatMap((student) =>
        student.enrollments.map((enrollment) => ({
          studentId: student.id,
          courseId: enrollment.course_id,
          enrolledOn: enrollment.enrolled_on,
          completionStatus: enrollment.completion_status,
          grade: enrollment.grade,
          rating: enrollment.rating,
          feePaid: enrollment.fee_paid,
        })),
      ),
      ['studentId', 'courseId'],
    );

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

  console.log(`Seeded ${source.courses.length} courses, ${source.students.length} students, and ${source.students.reduce((total, student) => total + student.enrollments.length, 0)} enrollments.`);
  await AppDataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});

