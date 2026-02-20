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
import { VetClinic } from '../../vet-clinics/entities/vet-clinic.entity';

@Entity('vaccinations')
export class Vaccination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vaccineName: string;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'date' })
  administeredDate: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ nullable: true })
  nextDueDate: Date;

  @Column()
  veterinarianName: string;

  @Column({ nullable: true })
  vetClinicId: string;

  @ManyToOne(() => VetClinic, { nullable: true })
  @JoinColumn({ name: 'vetClinicId' })
  vetClinic: VetClinic;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  certificateUrl: string;

  @Column({ nullable: true })
  certificateCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
