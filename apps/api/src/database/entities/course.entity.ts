import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Enrollment } from './enrollment.entity';

@Entity('courses')
export class Course {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 80 })
  category!: string;

  @Column({ type: 'varchar', length: 40 })
  level!: string;

  @Column({ type: 'varchar', length: 120 })
  instructor!: string;

  @Column({ name: 'duration_weeks', type: 'smallint' })
  durationWeeks!: number;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments!: Enrollment[];
}

