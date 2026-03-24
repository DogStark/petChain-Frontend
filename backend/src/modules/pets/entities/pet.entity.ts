import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Breed } from './breed.entity';
import { PetPhoto } from './pet-photo.entity';
import { PetShare } from './pet-share.entity';
import { PetSpecies } from './pet-species.enum';
import { PetGender } from './pet-gender.enum';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: PetSpecies,
    default: PetSpecies.DOG,
  })
  species: PetSpecies;

  @Column({ type: 'uuid', nullable: true, name: 'breed_id' })
  breedId: string;

  @ManyToOne(() => Breed, (breed) => breed.pets, { nullable: true })
  @JoinColumn({ name: 'breed_id' })
  breed: Breed;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth: Date;

  @Column({
    type: 'enum',
    enum: PetGender,
    default: PetGender.UNKNOWN,
  })
  gender: PetGender;

  @Column({ nullable: true, unique: true, name: 'microchip_id' })
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
  @Column({ nullable: true, name: 'insurance_policy' })
  insurancePolicy: string;

  @Column('text', { nullable: true })
  behaviorNotes: string;

  @OneToMany(() => PetPhoto, (photo) => photo.pet)
  photos: PetPhoto[];

  @OneToMany(() => PetShare, (share) => share.pet)
  shares: PetShare[];

  @Column({ default: false })
  neutered: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // Backward-compatible accessor used by other modules
  get microchipId(): string {
    return this.microchipNumber;
  }

  // Backward-compatible accessor used by other modules
  set microchipId(value: string) {
    this.microchipNumber = value;
  }
}

export { PetSpecies };
