import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pet } from '../../modules/pets/entities/pet.entity';

export enum BehaviorCategory {
  AGGRESSION = 'Aggression',
  ANXIETY = 'Anxiety',
  LETHARGY = 'Lethargy',
  EXCESSIVE_VOCALIZATION = 'Excessive barking/meowing',
  DESTRUCTIVE_BEHAVIOR = 'Destructive behavior',
  APPETITE_CHANGES = 'Appetite changes',
  SLEEP_CHANGES = 'Sleep changes',
  OTHER = 'Other',
}

export enum BehaviorSeverity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

@Entity('behavior_logs')
export class BehaviorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pet_id', type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({
    type: 'enum',
    enum: BehaviorCategory,
  })
  category: BehaviorCategory;

  @Column({
    type: 'enum',
    enum: BehaviorSeverity,
    default: BehaviorSeverity.LOW,
  })
  severity: BehaviorSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ nullable: true })
  duration: string;

  @Column({ type: 'text', nullable: true })
  triggers: string;

  @Column({ nullable: true })
  location: string;

  @Column({ name: 'shared_with_vet', default: false })
  sharedWithVet: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
