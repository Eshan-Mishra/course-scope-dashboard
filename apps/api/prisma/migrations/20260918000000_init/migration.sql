CREATE TYPE "UserRole" AS ENUM ('admin', 'manager');
CREATE TYPE "Region" AS ENUM ('East', 'North', 'South');
CREATE TYPE "CompletionStatus" AS ENUM ('completed', 'dropped', 'in_progress');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(160) NOT NULL,
  "password_hash" VARCHAR(100) NOT NULL,
  "role" "UserRole" NOT NULL,
  "region" "Region",
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_user_scope" CHECK ((role = 'admin' AND region IS NULL) OR (role = 'manager' AND region IS NOT NULL))
);

CREATE TABLE "students" (
  "id" VARCHAR(16) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "region" "Region" NOT NULL,
  "joined_on" DATE NOT NULL,
  CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courses" (
  "id" VARCHAR(16) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "level" VARCHAR(40) NOT NULL,
  "instructor" VARCHAR(120) NOT NULL,
  "duration_weeks" SMALLINT NOT NULL,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_course_duration" CHECK (duration_weeks > 0)
);

CREATE TABLE "enrollments" (
  "student_id" VARCHAR(16) NOT NULL,
  "course_id" VARCHAR(16) NOT NULL,
  "enrolled_on" DATE NOT NULL,
  "completion_status" "CompletionStatus" NOT NULL,
  "grade" VARCHAR(2),
  "rating" SMALLINT NOT NULL,
  "fee_paid" INTEGER NOT NULL,
  CONSTRAINT "enrollments_pkey" PRIMARY KEY ("student_id", "course_id"),
  CONSTRAINT "CHK_enrollment_grade" CHECK ((completion_status = 'completed' AND grade IS NOT NULL) OR (completion_status <> 'completed' AND grade IS NULL)),
  CONSTRAINT "CHK_enrollment_rating" CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT "CHK_enrollment_fee" CHECK (fee_paid >= 0)
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "IDX_students_region" ON "students"("region");
CREATE INDEX "IDX_courses_category" ON "courses"("category");
CREATE INDEX "IDX_enrollments_status" ON "enrollments"("completion_status");

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
