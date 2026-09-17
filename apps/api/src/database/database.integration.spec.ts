import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Student } from './entities/student.entity';
import { User } from './entities/user.entity';
import { seedDatabase } from './seed-data';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('database migration and seed integration', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource(databaseOptions(testDatabaseUrl));
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    await seedDatabase(dataSource);
    await seedDatabase(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('creates the schema and keeps the seed repeatable', async () => {
    await expect(dataSource.getRepository(Course).count()).resolves.toBe(12);
    await expect(dataSource.getRepository(Student).count()).resolves.toBe(50);
    await expect(dataSource.getRepository(Enrollment).count()).resolves.toBe(119);
    await expect(dataSource.getRepository(User).count()).resolves.toBe(3);
  });

  it('produces the expected all-region revenue total', async () => {
    const [{ revenue }] = (await dataSource
      .getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .select('SUM(enrollment.fee_paid)', 'revenue')
      .getRawMany<{ revenue: string }>()) as Array<{ revenue: string }>;

    expect(Number(revenue)).toBe(734800);
  });
});
