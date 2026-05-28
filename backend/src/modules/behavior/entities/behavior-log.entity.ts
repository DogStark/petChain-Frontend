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

/** Category of observed behavior */
export enum BehaviorType {
  AGGRESSION = 'aggression',
  ANXIETY = 'anxiety',
  APPETITE = 'appetite',
  ENERGY_LEVEL = 'energy_level',
  GROOMING = 'grooming',
  PLAY = 'play',
  SLEEP = 'sleep',
  SOCIAL = 'social',
  TRAINING = 'training',
  OTHER = 'other',
}

/** Severity level of the logged behavior */
export enum BehaviorSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

@Entity('behavior_logs')
@Index(['petId', 'observedAt'])
export class BehaviorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'pet_id' })
  @Index()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({
    type: 'enum',
    enum: BehaviorType,
    name: 'behavior_type',
  })
  behaviorType: BehaviorType;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: BehaviorSeverity,
    default: BehaviorSeverity.MILD,
  })
  severity: BehaviorSeverity;

  @Column({ type: 'timestamptz', name: 'observed_at' })
  @Index()
  observedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true, name: 'recorded_by' })
  recordedBy: string;

  @Column({ default: false, name: 'requires_vet_attention' })
  requiresVetAttention: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
