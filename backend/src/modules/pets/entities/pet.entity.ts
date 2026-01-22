import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
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
  })
  species: PetSpecies;

  @Column({ nullable: true })
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
  weight: number;

  @Column({ nullable: true })
  color: string;

  @Column({ type: 'text', nullable: true })
  specialNeeds: string;

  @Column({ nullable: true })
  profilePhoto: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
