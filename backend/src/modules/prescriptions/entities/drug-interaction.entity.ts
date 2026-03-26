import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Medication } from './medication.entity';

export enum InteractionSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CONTRAINDICATED = 'contraindicated',
}

@Entity('drug_interactions')
export class DrugInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  medicationId1: string;

  @ManyToOne(() => Medication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medicationId1' })
  medication1: Medication;

  @Column({ type: 'uuid' })
  medicationId2: string;

  @ManyToOne(() => Medication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medicationId2' })
  medication2: Medication;

  @Column({
    type: 'enum',
    enum: InteractionSeverity,
    default: InteractionSeverity.MODERATE,
  })
  severity: InteractionSeverity;

  @Column({ type: 'text' })
  description: string; // Description of the interaction

  @Column({ type: 'text', nullable: true })
  mechanism: string; // How the interaction occurs

  @Column({ type: 'text', nullable: true })
  managementStrategies: string; // How to manage the interaction

  @Column({ type: 'text', nullable: true })
  symptoms: string; // Symptoms to watch for

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
