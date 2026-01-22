import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { VaccinationSchedule } from '../../vaccinations/entities/vaccination-schedule.entity';

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT_7_DAYS = 'SENT_7_DAYS',
  SENT_3_DAYS = 'SENT_3_DAYS',
  SENT_DAY_OF = 'SENT_DAY_OF',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  SNOOZED = 'SNOOZED',
  CANCELLED = 'CANCELLED',
}

@Entity('vaccination_reminders')
export class VaccinationReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ nullable: true })
  vaccinationScheduleId: string;

  @ManyToOne(() => VaccinationSchedule, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vaccinationScheduleId' })
  vaccinationSchedule: VaccinationSchedule;

  @Column()
  vaccineName: string;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.PENDING,
  })
  status: ReminderStatus;

  /**
   * Custom reminder intervals in days before due date
   * Default: [7, 3, 0] for 7 days, 3 days, and day of
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

  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * Associated vaccination ID once completed
   */
  @Column({ nullable: true })
  vaccinationId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
