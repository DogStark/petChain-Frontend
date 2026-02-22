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

export enum ConditionStatus {
  ACTIVE = 'active',
  MANAGED = 'managed',
  RESOLVED = 'resolved',
  MONITORING = 'monitoring',
}

export enum ConditionSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

@Entity('conditions')
export class Condition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  conditionName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ConditionStatus,
    default: ConditionStatus.ACTIVE,
  })
  status: ConditionStatus;

  @Column({
    type: 'enum',
    enum: ConditionSeverity,
    default: ConditionSeverity.MILD,
  })
  severity: ConditionSeverity;

  @Column({ type: 'date' })
  diagnosedDate: Date;

  @Column({ type: 'text', nullable: true })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  medications: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  veterinarianName: string;

  @Column({ nullable: true })
  clinicName: string;

  @Column({ type: 'date', nullable: true })
  lastCheckupDate: Date;

  @Column({ type: 'date', nullable: true })
  nextCheckupDate: Date;

  @Column({ default: false })
  requiresOngoingCare: boolean;

  @Column({ default: false })
  isChronicCondition: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
