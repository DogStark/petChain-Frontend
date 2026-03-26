import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type OnboardingStepId =
  | 'welcome'
  | 'profile_setup'
  | 'add_pet'
  | 'notifications'
  | 'explore';

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  'welcome',
  'profile_setup',
  'add_pet',
  'notifications',
  'explore',
];

@Entity('user_onboarding')
@Index(['userId'], { unique: true })
export class UserOnboarding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ default: false })
  isSkipped: boolean;

  @Column({ default: 'welcome' })
  currentStep: string;

  @Column({ type: 'jsonb', default: [] })
  completedSteps: OnboardingStepId[];

  @Column({ type: 'jsonb', default: [] })
  skippedSteps: OnboardingStepId[];

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
