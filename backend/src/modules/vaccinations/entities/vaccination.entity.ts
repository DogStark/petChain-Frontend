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
import { VaccinationReaction } from './vaccination-reaction.entity';

@Entity('vaccinations')
export class Vaccination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vaccineName: string;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'date' })
  dateAdministered: Date;

  @Column({ type: 'date', nullable: true })
  nextDueDate: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date;

  @Column()
  veterinarianName: string;

  @Column({ nullable: true })
  vetClinicId: string;

  @ManyToOne(() => VetClinic, { nullable: true })
  @JoinColumn({ name: 'vetClinicId' })
  vetClinic: VetClinic;

  @Column({ nullable: true })
  site: string; // e.g., "Left front leg", "Right front leg"

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  certificateUrl: string;

  @Column({ nullable: true })
  certificateCode: string;

  @Column({ default: false })
  reminderSent: boolean;

  @OneToMany(() => VaccinationReaction, (reaction) => reaction.vaccination, {
    cascade: ['remove'],
  })
  reactions: VaccinationReaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
