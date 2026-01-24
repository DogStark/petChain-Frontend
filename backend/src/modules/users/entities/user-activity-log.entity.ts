import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum ActivityType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  AVATAR_UPLOAD = 'AVATAR_UPLOAD',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETION = 'DATA_DELETION',
  SECURITY_EVENT = 'SECURITY_EVENT',
}

@Entity('user_activity_logs')
@Index(['userId', 'createdAt'])
@Index(['userId', 'activityType'])
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.activityLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  deviceId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  isSuspicious: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
