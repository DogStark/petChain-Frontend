import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { Vet } from '../../vets/entities/vet.entity';

export enum SurgeryStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('surgeries')
export class Surgery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ type: 'uuid', nullable: true })
  vetId: string;

  @ManyToOne(() => Vet)
  @JoinColumn({ name: 'vetId' })
  vet: Vet;

  @Column()
  surgeryType: string;

  @Column({ type: 'date' })
  surgeryDate: Date;

  @Column({ type: 'enum', enum: SurgeryStatus, default: SurgeryStatus.SCHEDULED })
  status: SurgeryStatus;

  @Column({ type: 'text', nullable: true })
  preOpNotes: string;

  @Column({ type: 'text', nullable: true })
  postOpNotes: string;

  @Column({ type: 'simple-json', nullable: true })
  anesthesiaDetails: {
    type?: string;
    dosage?: string;
    duration?: number;
    complications?: string;
  };

  @Column({ type: 'simple-json', nullable: true })
  complications: string[];

  @Column({ type: 'simple-json', nullable: true })
  recoveryTimeline: {
    expectedDays?: number;
    milestones?: Array<{ date: string; description: string; completed: boolean }>;
  };

  @Column({ type: 'simple-json', nullable: true })
  photos: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
