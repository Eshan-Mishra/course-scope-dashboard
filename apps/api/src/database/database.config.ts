import { DataSourceOptions } from 'typeorm';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Student } from './entities/student.entity';
import { User } from './entities/user.entity';
import { InitSchema1726500000000 } from './migrations/1726500000000-InitSchema';

const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/course_scope';

export function databaseOptions(url = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [User, Student, Course, Enrollment],
    migrations: [InitSchema1726500000000],
    synchronize: false,
  };
}
