import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MedicationType {
  ANTIBIOTIC = 'antibiotic',
  PAIN_RELIEF = 'pain_relief',
  ANTI_INFLAMMATORY = 'anti_inflammatory',
  ANTIFUNGAL = 'antifungal',
  ANTIHISTAMINE = 'antihistamine',
  ANTIDIARRHEAL = 'antidiarrheal',
  ANTIEMETIC = 'antiemetic',
  CARDIAC = 'cardiac',
  DERMATOLOGICAL = 'dermatological',
  ENDOCRINE = 'endocrine',
  GASTROINTESTINAL = 'gastrointestinal',
  RESPIRATORY = 'respiratory',
  NEUROLOGICAL = 'neurological',
  OPHTHALMIC = 'ophthalmic',
  TOPICAL = 'topical',
  OTHER = 'other',
}

@Entity('medications')
export class Medication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  genericName: string;

  @Column({ nullable: true })
  brandNames: string; // Comma-separated list

  @Column({
    type: 'enum',
    enum: MedicationType,
    default: MedicationType.OTHER,
  })
  type: MedicationType;

  @Column({ type: 'text' })
  activeIngredient: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  sideEffects: string; // Comma-separated or detailed list

  @Column({ type: 'text', nullable: true })
  contraindications: string; // Medical conditions/medications to avoid with

  @Column({ type: 'text', nullable: true })
  warnings: string; // Special precautions and warnings

  @Column({ type: 'text', nullable: true })
  precautions: string; // Additional precautions

  @Column({ nullable: true })
  dosageUnits: string; // e.g., mg, ml, units

  @Column({ nullable: true })
  typicalDosageRange: string; // e.g., "5-10 mg/kg"

  @Column({ nullable: true })
  maxDailyDose: string;

  @Column({ type: 'text', nullable: true })
  petSpecificInfo: string; // Species-specific information

  @Column({ nullable: true })
  foodInteractions: string; // Take with/without food

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ type: 'text', nullable: true })
  storageInstructions: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
