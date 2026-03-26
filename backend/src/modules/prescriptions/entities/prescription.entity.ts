import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { Vet } from '../../vets/entities/vet.entity';
import { PrescriptionRefill } from './prescription-refill.entity';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  EXPIRED = 'expired',
  COMPLETED = 'completed',
  DISCONTINUED = 'discontinued',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ type: 'uuid' })
  vetId: string;

  @ManyToOne(() => Vet, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vetId' })
  vet: Vet;

  @Column()
  medication: string;

  @Column()
  dosage: string;

  @Column()
  frequency: string;

  @Column({ type: 'int', nullable: true })
  duration: number; // Duration in days

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  instructions: string; // Detailed medication instructions

  @Column({ nullable: true })
  pharmacyInfo: string;

  @Column({ type: 'int', default: 0 })
  refillsRemaining: number;

  @Column({ type: 'int', default: 0 })
  refillsUsed: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.PENDING,
  })
  status: PrescriptionStatus;

  @OneToMany(
    () => PrescriptionRefill,
    (refill) => refill.prescription,
    { eager: true },
  )
  refills: PrescriptionRefill[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
