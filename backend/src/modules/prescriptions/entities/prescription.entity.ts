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

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  petId: string;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  medication: string;

  @Column()
  dosage: string;

  @Column()
  frequency: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'uuid', nullable: true })
  prescribedBy: string;

  @ManyToOne(() => Vet)
  @JoinColumn({ name: 'prescribedBy' })
  vet: Vet;

  @Column({ nullable: true })
  pharmacyInfo: string;

  @Column({ type: 'int', default: 0 })
  refillsRemaining: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
