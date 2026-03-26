import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('emergency_services')
@Index(['serviceType'])
@Index(['location'])
export class EmergencyService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  serviceType: string; // Emergency Clinic, 24/7 Hospital, Mobile Vet, etc.

  @Column({ type: 'simple-array', nullable: true })
  services: string[]; // List of services offered

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  emergencyPhone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column()
  location: string; // City, State, Country

  @Column()
  address: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  is24Hours: boolean;

  @Column({ type: 'jsonb', nullable: true })
  operatingHours: Record<string, any>;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageWaitTime: number; // in minutes

  @Column({ default: 'available' })
  status: string; // available, busy, closed

  @Column({ type: 'simple-array', nullable: true })
  acceptedInsurance: string[];

  @Column({ nullable: true })
  website: string;

  @Column({ type: 'simple-array', nullable: true })
  specializations: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
