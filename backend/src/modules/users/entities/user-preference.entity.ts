import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.preferences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: false })
  smsNotifications: boolean;

  @Column({ default: false })
  pushNotifications: boolean;

  @Column({ default: false })
  dataShareConsent: boolean;

  @Column({ default: true })
  profilePublic: boolean;

  @Column({ nullable: true })
  preferredLanguage: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ default: false })
  marketingEmails: boolean;

  @Column({ default: true })
  activityEmails: boolean;

  @Column({ type: 'jsonb', nullable: true })
  privacySettings: {
    showEmail?: boolean;
    showPhone?: boolean;
    showActivity?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
