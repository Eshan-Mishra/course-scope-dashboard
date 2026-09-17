import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1726500000000 implements MigrationInterface {
  name = 'InitSchema1726500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('admin', 'manager')`);
    await queryRunner.query(`CREATE TYPE "region_enum" AS ENUM ('East', 'North', 'South')`);
    await queryRunner.query(`CREATE TYPE "completion_status_enum" AS ENUM ('completed', 'dropped', 'in_progress')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(160) NOT NULL UNIQUE,
        "password_hash" varchar(100) NOT NULL,
        "role" user_role_enum NOT NULL,
        "region" region_enum,
        CONSTRAINT "CHK_user_scope" CHECK ((role = 'admin' AND region IS NULL) OR (role = 'manager' AND region IS NOT NULL))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" varchar(16) PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "region" region_enum NOT NULL,
        "joined_on" date NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id" varchar(16) PRIMARY KEY,
        "title" varchar(160) NOT NULL,
        "category" varchar(80) NOT NULL,
        "level" varchar(40) NOT NULL,
        "instructor" varchar(120) NOT NULL,
        "duration_weeks" smallint NOT NULL CHECK (duration_weeks > 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "student_id" varchar(16) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        "course_id" varchar(16) NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
        "enrolled_on" date NOT NULL,
        "completion_status" completion_status_enum NOT NULL,
        "grade" varchar(2),
        "rating" smallint NOT NULL,
        "fee_paid" integer NOT NULL,
        PRIMARY KEY (student_id, course_id),
        CONSTRAINT "CHK_enrollment_grade" CHECK ((completion_status = 'completed' AND grade IS NOT NULL) OR (completion_status <> 'completed' AND grade IS NULL)),
        CONSTRAINT "CHK_enrollment_rating" CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT "CHK_enrollment_fee" CHECK (fee_paid >= 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_students_region" ON students(region)`);
    await queryRunner.query(`CREATE INDEX "IDX_courses_category" ON courses(category)`);
    await queryRunner.query(`CREATE INDEX "IDX_enrollments_status" ON enrollments(completion_status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "enrollments"`);
    await queryRunner.query(`DROP TABLE "courses"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "completion_status_enum"`);
    await queryRunner.query(`DROP TYPE "region_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}

