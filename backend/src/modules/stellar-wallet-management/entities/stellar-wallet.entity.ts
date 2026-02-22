import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StellarWalletAuditLog } from './stellar-wallet-audit-log.entity';

export type StellarWalletNetwork = 'PUBLIC' | 'TESTNET';

export interface MultisigSignerConfig {
  key: string;
  weight: number;
}

export interface MultisigConfig {
  threshold: number;
  signers: MultisigSignerConfig[];
}

@Entity('stellar_wallets')
@Index(['userId', 'network'], { unique: true })
export class StellarWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column()
  userId: string;

  @Column()
  publicKey: string;

  /**
   * AES-256-GCM encrypted secret key. Never store plaintext.
   */
  @Column({ type: 'text' })
  encryptedSecretKey: string;

  @Column({ type: 'varchar', length: 64 })
  encryptionIv: string;

  @Column({ type: 'varchar', length: 64 })
  encryptionAuthTag: string;

  @Column({ type: 'varchar', length: 16 })
  network: StellarWalletNetwork;

  @Column({ default: false })
  isMultiSig: boolean;

  @Column({ type: 'jsonb', nullable: true })
  multisigConfig: MultisigConfig | null;

  @OneToMany(() => StellarWalletAuditLog, (log) => log.wallet)
  auditLogs: StellarWalletAuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
