import { CompletionStatus, PrismaClient, Region, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

export async function seedDatabase(prisma: PrismaClient, sourcePath?: string) {
  const filePath = sourcePath ?? process.env.SOURCE_DATA_PATH ?? resolve(__dirname, '../../../../data/data.json');
  const source = JSON.parse(await readFile(filePath, 'utf8')) as SourceData;
  const enrollments = source.students.flatMap((student) =>
    student.enrollments.map((enrollment) => ({ studentId: student.id, ...enrollment })),
  );
  const passwordHash = await hash('Demo@123', 10);

  await prisma.$transaction([
    ...source.courses.map((course) => {
      const data = {
        id: course.id,
        title: course.title,
        category: course.category,
        level: course.level,
        instructor: course.instructor,
        durationWeeks: course.duration_weeks,
      };
      return prisma.course.upsert({ where: { id: course.id }, create: data, update: data });
    }),
    ...source.students.map((student) => {
      const data = {
        id: student.id,
        name: student.name,
        region: student.region,
        joinedOn: new Date(`${student.joined_on}T00:00:00.000Z`),
      };
      return prisma.student.upsert({ where: { id: student.id }, create: data, update: data });
    }),
    ...enrollments.map((enrollment) => {
      const data = {
        studentId: enrollment.studentId,
        courseId: enrollment.course_id,
        enrolledOn: new Date(`${enrollment.enrolled_on}T00:00:00.000Z`),
        completionStatus: enrollment.completion_status,
        grade: enrollment.grade,
        rating: enrollment.rating,
        feePaid: enrollment.fee_paid,
      };
      return prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: data.studentId, courseId: data.courseId } },
        create: data,
        update: data,
      });
    }),
    ...[
      { email: 'admin@coursescope.test', role: UserRole.admin, region: null },
      { email: 'north@coursescope.test', role: UserRole.manager, region: Region.North },
      { email: 'south@coursescope.test', role: UserRole.manager, region: Region.South },
    ].map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash },
        update: {},
      }),
    ),
  ]);

  return { courses: source.courses.length, students: source.students.length, enrollments: enrollments.length };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await seedDatabase(prisma);
    console.log(`Seeded ${result.courses} courses, ${result.students} students, and ${result.enrollments} enrollments.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
