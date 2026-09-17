import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Course } from './course.entity';
import { Student } from './student.entity';

export enum CompletionStatus {
  COMPLETED = 'completed',
  DROPPED = 'dropped',
  IN_PROGRESS = 'in_progress',
}

@Entity('enrollments')
@Check('CHK_enrollment_grade', `("completion_status" = 'completed' AND "grade" IS NOT NULL) OR ("completion_status" <> 'completed' AND "grade" IS NULL)`)
@Check('CHK_enrollment_rating', '"rating" BETWEEN 1 AND 5')
@Check('CHK_enrollment_fee', '"fee_paid" >= 0')
export class Enrollment {
  @PrimaryColumn({ name: 'student_id', type: 'varchar', length: 16 })
  studentId!: string;

  @PrimaryColumn({ name: 'course_id', type: 'varchar', length: 16 })
  courseId!: string;

  @Column({ name: 'enrolled_on', type: 'date' })
  enrolledOn!: string;

  @Column({ name: 'completion_status', type: 'enum', enum: CompletionStatus })
  completionStatus!: CompletionStatus;

  @Column({ type: 'varchar', length: 2, nullable: true })
  grade!: string | null;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ name: 'fee_paid', type: 'integer' })
  feePaid!: number;

  @ManyToOne(() => Student, (student) => student.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @ManyToOne(() => Course, (course) => course.enrollments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;
}

