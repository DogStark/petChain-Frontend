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
import { VetClinic } from './vet-clinic.entity';
import { VaccinationReminder } from '../../reminders/entities/vaccination-reminder.entity';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  VACCINATION = 'VACCINATION',
  CHECKUP = 'CHECKUP',
  EMERGENCY = 'EMERGENCY',
  GROOMING = 'GROOMING',
  OTHER = 'OTHER',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vetClinicId: string;

  @ManyToOne(() => VetClinic, (clinic) => clinic.appointments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vetClinicId' })
  vetClinic: VetClinic;

  @Column({ nullable: true })
  reminderId: string;

  @ManyToOne(() => VaccinationReminder, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reminderId' })
  reminder: VaccinationReminder;

  @Column({ type: 'timestamp' })
  scheduledDate: Date;

  @Column({ nullable: true })
  duration: number; // Duration in minutes

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.VACCINATION,
  })
  type: AppointmentType;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  veterinarianName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
