import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Breed } from './breed.entity';
import { PetPhoto } from './pet-photo.entity';
import { PetSpecies } from './pet-species.enum';
import { PetGender } from './pet-gender.enum';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PetSpecies,
    default: PetSpecies.DOG,
  })
  species: PetSpecies;

  @Column({ type: 'uuid', nullable: true })
  breedId: string;

  @ManyToOne(() => Breed, (breed) => breed.pets, { nullable: true })
  @JoinColumn({ name: 'breedId' })
  breed: Breed;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({
    type: 'enum',
    enum: PetGender,
    default: PetGender.UNKNOWN,
  })
  gender: PetGender;

  @Column({ nullable: true, unique: true })
  microchipNumber: string;

  @Column({ nullable: true })
  tagId: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  weight: number;

  @Column({ nullable: true })
  color: string;

  @Column({ type: 'text', nullable: true })
  specialNeeds: string;

  // New fields based on requirements
  @Column({ nullable: true })
  insurancePolicy: string;

  @Column('text', { nullable: true })
  behaviorNotes: string;

  @OneToMany(() => PetPhoto, (photo) => photo.pet)
  photos: PetPhoto[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export { PetSpecies };
