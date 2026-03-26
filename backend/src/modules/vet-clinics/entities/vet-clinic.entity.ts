import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Appointment } from './appointment.entity';

@Entity('vet_clinics')
export class VetClinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zipCode: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  /**
   * Operating hours stored as JSON
   * Format: { monday: { open: "08:00", close: "18:00" }, ... }
   */
  @Column({ type: 'jsonb', nullable: true })
  operatingHours: Record<string, { open: string; close: string }>;

  /**
   * Services offered by the clinic
   */
  @Column({ type: 'simple-array', nullable: true })
  services: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  acceptsWalkIns: boolean;

  @Column({ nullable: true })
  notes: string;

  @OneToMany(() => Appointment, (appointment) => appointment.vetClinic)
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
