import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vaccination } from './vaccination.entity';

/**
 * Tracks adverse reactions to vaccinations
 * Supports HIPAA-compliant adverse event logging
 */
@Entity('vaccination_reactions')
export class VaccinationReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vaccinationId: string;

  @ManyToOne(() => Vaccination, (vaccination) => vaccination.reactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vaccinationId' })
  vaccination: Vaccination;

  /**
   * Type of reaction: MILD, MODERATE, SEVERE
   */
  @Column({ type: 'enum', enum: ['MILD', 'MODERATE', 'SEVERE'] })
  severity: 'MILD' | 'MODERATE' | 'SEVERE';

  /**
   * Description of the adverse reaction
   * e.g., "Swelling at injection site", "Lethargy", "Fever"
   */
  @Column({ type: 'text' })
  description: string;

  /**
   * Time from vaccination to onset of reaction (in hours)
   */
  @Column({ type: 'integer', nullable: true })
  onsetHours: number;

  /**
   * Duration of reaction (in hours)
   */
  @Column({ type: 'integer', nullable: true })
  durationHours: number;

  /**
   * Treatment provided
   */
  @Column({ type: 'text', nullable: true })
  treatment: string;

  /**
   * Whether the pet required veterinary intervention
   */
  @Column({ default: false })
  requiredVeterinaryIntervention: boolean;

  /**
   * Notes about the reaction
   */
  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * Whether this reaction was reported to the vaccine manufacturer
   */
  @Column({ default: false })
  reportedToManufacturer: boolean;

  /**
   * Manufacturer report reference number
   */
  @Column({ nullable: true })
  manufacturerReportId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
