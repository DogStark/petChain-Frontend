import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LostPetReport } from './lost-pet-report.entity';

@Entity('pet_sightings')
export class PetSighting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lostPetReportId: string;

  @ManyToOne(() => LostPetReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lostPetReportId' })
  lostPetReport: LostPetReport;

  @Column({ type: 'uuid' })
  reportedByUserId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  @CreateDateColumn()
  reportedAt: Date;
}
