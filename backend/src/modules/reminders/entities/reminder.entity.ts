import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { User } from '../../users/entities/user.entity';

export enum ReminderType {
  VACCINATION = 'VACCINATION',
  APPOINTMENT = 'APPOINTMENT',
  MEDICATION = 'MEDICATION',
  CUSTOM = 'CUSTOM',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT_7_DAYS = 'SENT_7_DAYS',
  SENT_3_DAYS = 'SENT_3_DAYS',
  SENT_1_DAY = 'SENT_1_DAY', // Added for 1 day reminder
  SENT_DAY_OF = 'SENT_DAY_OF',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  SNOOZED = 'SNOOZED',
  CANCELLED = 'CANCELLED',
}

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  type: ReminderType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  @Index()
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.PENDING,
  })
  status: ReminderStatus;

  /**
   * Custom reminder intervals in days before due date
   * Default: [7, 3, 1, 0] for 7 days, 3 days, 1 day, and day of
   */
  @Column({ type: 'simple-array', nullable: true })
  customIntervalDays: number[];

  /**
   * Timestamps when reminders were sent
   */
  @Column({ type: 'simple-array', nullable: true })
  reminderSentAt: string[];

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  snoozedUntil: Date;

  /**
   * Generic metadata for specific reminder types
   * e.g., { vaccinationScheduleId: '...', appointmentId: '...', prescriptionId: '...' }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
