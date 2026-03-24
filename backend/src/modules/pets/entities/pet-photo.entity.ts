import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Pet } from './pet.entity';

@Entity('pet_photos')
export class PetPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet, (pet) => pet.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  photoUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true })
  storageKey: string;

  @Column({ nullable: true })
  thumbnailStorageKey: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  fileSize: number;

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ nullable: true })
  originalFilename: string;

  @Column('jsonb', { nullable: true })
  facialRecognitionData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
