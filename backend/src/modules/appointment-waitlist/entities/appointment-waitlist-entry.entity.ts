import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { VetClinic } from '../../vet-clinics/entities/vet-clinic.entity';

export enum AppointmentType {
  VACCINATION = 'VACCINATION',
  CHECKUP = 'CHECKUP',
  EMERGENCY = 'EMERGENCY',
  GROOMING = 'GROOMING',
  OTHER = 'OTHER',
}

@Entity('appointment_waitlist_entries')
@Index(['vetClinicId', 'expiresAt'])
@Index(['petId', 'vetClinicId'], { unique: true })
export class AppointmentWaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vetClinicId: string;

  @ManyToOne(() => VetClinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetClinicId' })
  vetClinic: VetClinic;

  /** Lower number = higher priority. Default 0. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  /** Optional: preferred appointment type. Null = any type. */
  @Column({
    type: 'enum',
    enum: AppointmentType,
    nullable: true,
  })
  preferredType: AppointmentType | null;

  /** Entry expires at this time. Users must rejoin after expiry. */
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** When user was notified of a slot opening (to avoid duplicate notifications) */
  @Column({ type: 'timestamp', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
