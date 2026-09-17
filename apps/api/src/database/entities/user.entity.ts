import { Region, UserRole } from '@course-scope/contracts';
import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('users')
@Unique(['email'])
@Check('CHK_user_scope', `("role" = 'admin' AND "region" IS NULL) OR ("role" = 'manager' AND "region" IS NOT NULL)`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ type: 'enum', enum: Region, nullable: true })
  region!: Region | null;
}
