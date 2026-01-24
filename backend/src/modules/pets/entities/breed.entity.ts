import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Pet } from './pet.entity';
import { PetSpecies } from './pet-species.enum';
import { VaccinationSchedule } from '../../vaccinations/entities/vaccination-schedule.entity';

@Entity('breeds')
export class Breed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PetSpecies,
    default: PetSpecies.DOG,
  })
  species: PetSpecies;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  lifeExpectancy: string;

  @Column({ nullable: true })
  averageWeight: string;

  @Column({ nullable: true })
  sizeCategory: string;

  @Column('jsonb', { nullable: true })
  commonHealthIssues: string[];

  @Column('text', { nullable: true })
  careRequirements: string;

  @OneToMany(() => Pet, (pet) => pet.breed)
  pets: Pet[];

  @OneToMany(() => VaccinationSchedule, (schedule) => schedule.breed)
  vaccinationSchedules: VaccinationSchedule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
