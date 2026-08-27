import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VetClinic } from './vet-clinic.entity';

export enum DayOfWeek {
  MONDAY = 0,
  TUESDAY = 1,
  WEDNESDAY = 2,
  THURSDAY = 3,
  FRIDAY = 4,
  SATURDAY = 5,
  SUNDAY = 6,
}

@Entity('clinic_schedules')
export class ClinicSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => VetClinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: VetClinic;

  @Column({ type: 'int' })
  dayOfWeek: DayOfWeek;

  /** HH:MM format, e.g. "08:00" */
  @Column({ type: 'varchar', length: 5 })
  openTime: string;

  /** HH:MM format, e.g. "18:00" */
  @Column({ type: 'varchar', length: 5 })
  closeTime: string;

  @Column({ type: 'int', default: 30 })
  slotDurationMinutes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
