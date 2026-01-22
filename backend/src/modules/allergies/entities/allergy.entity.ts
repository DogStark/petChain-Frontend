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

export enum AllergySeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life_threatening',
}

@Entity('allergies')
export class Allergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  allergen: string;

  @Column({
    type: 'enum',
    enum: AllergySeverity,
  })
  severity: AllergySeverity;

  @Column({ type: 'text', nullable: true })
  reactionNotes: string;

  @Column({ type: 'date' })
  discoveredDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
