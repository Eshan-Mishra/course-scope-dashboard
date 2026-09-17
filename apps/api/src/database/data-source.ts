import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Student } from './entities/student.entity';
import { User } from './entities/user.entity';
import { InitSchema1726500000000 } from './migrations/1726500000000-InitSchema';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/course_scope',
  entities: [User, Student, Course, Enrollment],
  migrations: [InitSchema1726500000000],
  synchronize: false,
});

export default AppDataSource;
