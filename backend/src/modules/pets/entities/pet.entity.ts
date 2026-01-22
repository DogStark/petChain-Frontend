import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
<<<<<<< HEAD
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PetGender {
  MALE = 'male',
  FEMALE = 'female',
  UNKNOWN = 'unknown',
}

export enum PetSpecies {
  DOG = 'dog',
  CAT = 'cat',
  BIRD = 'bird',
  REPTILE = 'reptile',
  RABBIT = 'rabbit',
  HAMSTER = 'hamster',
  FISH = 'fish',
  OTHER = 'other',
}
=======
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Breed } from './breed.entity';
import { PetSpecies } from './pet-species.enum';

// Re-export for convenience
export { PetSpecies } from './pet-species.enum';
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

<<<<<<< HEAD
  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

=======
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PetSpecies,
<<<<<<< HEAD
=======
    default: PetSpecies.DOG,
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  })
  species: PetSpecies;

  @Column({ nullable: true })
<<<<<<< HEAD
  breed: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({
    type: 'enum',
    enum: PetGender,
    default: PetGender.UNKNOWN,
  })
  gender: PetGender;

  @Column({ nullable: true })
  microchipNumber: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
=======
  breedId: string;

  @ManyToOne(() => Breed, (breed) => breed.pets, { nullable: true })
  @JoinColumn({ name: 'breedId' })
  breed: Breed;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ nullable: true })
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  weight: number;

  @Column({ nullable: true })
  color: string;

<<<<<<< HEAD
  @Column({ type: 'text', nullable: true })
  specialNeeds: string;

  @Column({ nullable: true })
  profilePhoto: string;
=======
  @Column({ nullable: true })
  microchipNumber: string;

  @Column({ nullable: true })
  ownerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ default: true })
  isActive: boolean;
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
