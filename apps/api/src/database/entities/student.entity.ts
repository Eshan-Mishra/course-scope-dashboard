import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Region } from '../../common/access.types';
import { Enrollment } from './enrollment.entity';

@Entity('students')
export class Student {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'enum', enum: Region })
  region!: Region;

  @Column({ name: 'joined_on', type: 'date' })
  joinedOn!: string;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments!: Enrollment[];
}

