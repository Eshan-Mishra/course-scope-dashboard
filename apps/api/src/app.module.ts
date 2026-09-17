import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { Course } from './database/entities/course.entity';
import { Enrollment } from './database/entities/enrollment.entity';
import { Student } from './database/entities/student.entity';
import { User } from './database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/course_scope',
      entities: [User, Student, Course, Enrollment],
      synchronize: false,
    }),
    AuthModule,
    AnalyticsModule,
  ],
})
export class AppModule {}

