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

@Entity('vaccinations')
export class Vaccination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vaccineName: string;

  @Column({ type: 'date' })
  dateAdministered: Date;

  @Column({ type: 'date' })
  nextDueDate: Date;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'uuid', nullable: true })
  administeredBy: string;

  @ManyToOne(() => Vet)
  @JoinColumn({ name: 'administeredBy' })
  vet: Vet;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  reminderSent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
