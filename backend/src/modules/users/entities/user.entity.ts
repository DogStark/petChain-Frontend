import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../auth/entities/user-role.entity';
import { UserPreference } from './user-preference.entity';
import { UserSession } from './user-session.entity';
import { UserActivityLog } from './user-activity-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatarUrl: string;

  // additional profile fields
  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ default: false })
  isDeactivated: boolean;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @OneToMany(() => UserPreference, (preference) => preference.user)
  preferences: UserPreference[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];

  @OneToMany(() => UserActivityLog, (log) => log.user)
  activityLogs: UserActivityLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Get active role assignments
   */
  getActiveRoles(): UserRole[] {
    return this.userRoles?.filter((ur) => ur.isActive) || [];
  }

  /**
   * Get profile completion score based on required fields. Added new fields.
   */
  getProfileCompletionScore(): number {
    let score = 0;
    const fields = [
      this.firstName,
      this.lastName,
      this.email,
      this.phone,
      this.avatarUrl,
      this.dateOfBirth,
      this.address,
      this.city,
      this.country,
    ];

    fields.forEach((field) => {
      if (field) {
        score += Math.floor(100 / fields.length);
      }
    });

    // Ensure score is not greater than 100
    return Math.min(score, 100);
  }
}
