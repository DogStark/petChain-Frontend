import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
}

export enum RecordType {
  VACCINATION = 'vaccination',
  TREATMENT = 'treatment',
  ALLERGY = 'allergy',
}

@Entity('blockchain_syncs')
export class BlockchainSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  recordId: string;

  @Column({
    type: 'enum',
    enum: RecordType,
  })
  recordType: RecordType;

  @Column({ nullable: true })
  txHash: string;

  @Column({ nullable: true })
  ipfsHash: string;

  @Column()
  recordHash: string;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  status: SyncStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
