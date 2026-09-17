import 'reflect-metadata';
import AppDataSource from './data-source';
import { seedDatabase } from './seed-data';

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations({ transaction: 'all' });
  const result = await seedDatabase(AppDataSource);
  console.log(`Seeded ${result.courses} courses, ${result.students} students, and ${result.enrollments} enrollments.`);
  await AppDataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
