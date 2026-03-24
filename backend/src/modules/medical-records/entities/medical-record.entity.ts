import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { Pet } from '../../pets/entities/pet.entity';
import { Vet } from '../../vets/entities/vet.entity';

export enum RecordType {
  CHECKUP = 'checkup',
  SURGERY = 'surgery',
  EMERGENCY = 'emergency',
  DIAGNOSTIC = 'diagnostic',
  VACCINATION = 'vaccination',
  DENTAL = 'dental',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  FOLLOW_UP = 'follow_up',
  OTHER = 'other',
}

export enum AccessLevel {
  PUBLIC = 'public',
  RESTRICTED = 'restricted',
  CONFIDENTIAL = 'confidential',
}

@Entity('medical_records')
export class MedicalRecord {
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

  @Column({
    type: 'enum',
    enum: RecordType,
  })
  recordType: RecordType;

  @Column({ type: 'date', name: 'visit_date' })
  visitDate: Date;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'text' })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({ nullable: true })
  qrCode: string;

  // --- Vet Verification / Signature ---
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  verifiedByVetId: string;

  @ManyToOne(() => Vet, { nullable: true })
  @JoinColumn({ name: 'verifiedByVetId' })
  verifiedByVet: Vet;

  @Column({ type: 'text', nullable: true })
  digitalSignature: string;

  // --- Record Versioning ---
  @VersionColumn()
  version: number;

  @Column({ type: 'uuid', nullable: true })
  previousVersionId: string;

  // --- HIPAA Compliance ---
  @Column({
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.RESTRICTED,
  })
  accessLevel: AccessLevel;

  @Column({ nullable: true })
  encryptionKeyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
