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
<<<<<<< HEAD
import { Vet } from '../../vets/entities/vet.entity';
=======
import { VetClinic } from '../../vet-clinics/entities/vet-clinic.entity';
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

@Entity('vaccinations')
export class Vaccination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

<<<<<<< HEAD
  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
=======
  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vaccineName: string;

<<<<<<< HEAD
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
=======
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
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

  @Column({ type: 'text', nullable: true })
  notes: string;

<<<<<<< HEAD
  @Column({ default: false })
  reminderSent: boolean;
=======
  @Column({ nullable: true })
  certificateUrl: string;

  @Column({ nullable: true })
  certificateCode: string;
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
