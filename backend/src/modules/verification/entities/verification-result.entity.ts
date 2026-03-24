import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VerificationStatus {
  VERIFIED = 'verified',
  FAILED = 'failed',
  TAMPERED = 'tampered',
  PENDING = 'pending',
}

@Entity('verification_results')
export class VerificationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  recordId: string;

  @Column()
  recordType: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ type: 'simple-json', nullable: true })
  integrityDetails: {
    localMatch: boolean;
    blockchainMatch: boolean;
    ipfsMatch: boolean;
  };

  @Column({ nullable: true })
  txHash: string;

  @Column({ nullable: true })
  ipfsHash: string;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
