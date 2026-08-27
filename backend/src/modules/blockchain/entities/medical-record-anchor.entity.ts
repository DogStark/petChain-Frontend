import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AnchorStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  ANCHORED = 'anchored',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('medical_record_anchors')
export class MedicalRecordAnchor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  recordId: string;

  /** SHA-256 of the canonical record payload */
  @Column()
  recordHash: string;

  @Column({ type: 'enum', enum: AnchorStatus, default: AnchorStatus.PENDING })
  @Index()
  status: AnchorStatus;

  /** Stellar transaction hash once submitted */
  @Column({ nullable: true })
  txHash: string;

  /** Ledger sequence number of confirmed transaction */
  @Column({ type: 'bigint', nullable: true })
  ledgerSequence: number;

  /** Fee paid in stroops */
  @Column({ nullable: true })
  feePaid: string;

  /** Batch ID when anchored as part of a batch */
  @Column({ nullable: true })
  @Index()
  batchId: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  lastError: string;

  @Column({ type: 'timestamp', nullable: true })
  anchoredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
