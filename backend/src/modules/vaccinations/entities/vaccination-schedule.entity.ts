import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Breed } from '../../pets/entities/breed.entity';

@Entity('vaccination_schedules')
export class VaccinationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  breedId: string;

  @ManyToOne(() => Breed, (breed) => breed.vaccinationSchedules, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'breedId' })
  breed: Breed;

  @Column()
  vaccineName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Recommended age in weeks for first dose
   */
  @Column()
  recommendedAgeWeeks: number;

  /**
   * Interval in weeks for recurring vaccines (null for one-time vaccines)
   */
  @Column({ nullable: true })
  intervalWeeks: number;

  /**
   * Number of initial doses required
   */
  @Column({ default: 1 })
  dosesRequired: number;

  /**
   * Whether this vaccine is legally required
   */
  @Column({ default: false })
  isRequired: boolean;

  /**
   * Whether this schedule is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Priority for reminder ordering (higher = more important)
   */
  @Column({ default: 1 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
