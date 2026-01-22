import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Breed } from './breed.entity';
import { PetSpecies } from './pet-species.enum';

// Re-export for convenience
export { PetSpecies } from './pet-species.enum';

@Entity('pets')
export class Pet {
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
  breedId: string;

  @ManyToOne(() => Breed, (breed) => breed.pets, { nullable: true })
  @JoinColumn({ name: 'breedId' })
  breed: Breed;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ nullable: true })
  weight: number;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  microchipNumber: string;

  @Column({ nullable: true })
  ownerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
