import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';

export enum LostPetStatus {
  LOST = 'LOST',
  FOUND = 'FOUND',
}

@Entity('lost_pet_reports')
@Index(['status'])
@Index(['petId'])
@Index(['reportedDate'])
export class LostPetReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({
    type: 'enum',
    enum: LostPetStatus,
    default: LostPetStatus.LOST,
  })
  status: LostPetStatus;

  @Column({ type: 'timestamp' })
  reportedDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lastSeenLatitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lastSeenLongitude: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenDate: Date | null;

  @Column({ type: 'text', nullable: true })
  customMessage: string | null;

  @Column({ type: 'text', nullable: true })
  contactInfo: string | null;

  @Column({ type: 'timestamp', nullable: true })
  foundDate: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  foundLatitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  foundLongitude: number | null;

  @Column({ type: 'text', nullable: true })
  foundLocation: string | null;

  @Column({ type: 'text', nullable: true })
  foundDetails: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
