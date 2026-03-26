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
import { Pet } from '../../pets/entities/pet.entity';
import { VetClinic } from '../../vet-clinics/entities/vet-clinic.entity';
import { Vet } from '../../vets/entities/vet.entity';
import { VaccinationAdverseReaction } from './vaccination-adverse-reaction.entity';

@Entity('vaccinations')
export class Vaccination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pet_id' })
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'vet_id', nullable: true })
  vetId: string | null;

  @ManyToOne(() => Vet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vet_id' })
  vet: Vet | null;

  @Column({ name: 'vaccine_name' })
  vaccineName: string;

  @Column({ nullable: true })
  manufacturer: string | null;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string | null;

  @Column({ type: 'date', name: 'date_administered' })
  administeredDate: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date | null;

  @Column({ type: 'date', name: 'next_due_date', nullable: true })
  nextDueDate: Date | null;

  @Column({ nullable: true })
  site: string | null;

  @Column({ nullable: true })
  veterinarianName: string | null;

  @Column({ nullable: true })
  vetClinicId: string | null;

  @ManyToOne(() => VetClinic, { nullable: true })
  @JoinColumn({ name: 'vetClinicId' })
  vetClinic: VetClinic | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ nullable: true })
  certificateUrl: string | null;

  @Column({ nullable: true })
  certificateCode: string | null;

  @Column({ default: false })
  reminderSent: boolean;

  @OneToMany(
    () => VaccinationAdverseReaction,
    (reaction) => reaction.vaccination,
    { cascade: true },
  )
  adverseReactions: VaccinationAdverseReaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
