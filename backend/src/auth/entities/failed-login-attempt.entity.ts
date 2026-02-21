import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('failed_login_attempts')
@Index(['ipAddress', 'createdAt'])
@Index(['email', 'createdAt'])
export class FailedLoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ nullable: true })
  deviceFingerprint: string;

  @CreateDateColumn()
  createdAt: Date;
}