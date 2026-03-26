import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StellarWallet } from './stellar-wallet.entity';

export type StellarWalletOperationType =
  | 'CREATE'
  | 'AUTO_CREATE'
  | 'BALANCE_CHECK'
  | 'PREPARE_TRANSACTION'
  | 'SIGN_TRANSACTION'
  | 'SUBMIT_TRANSACTION'
  | 'BACKUP_EXPORT'
  | 'RECOVERY'
  | 'SWITCH_NETWORK';

@Entity('stellar_wallet_audit_logs')
export class StellarWalletAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StellarWallet, (wallet) => wallet.auditLogs, { nullable: false })
  wallet: StellarWallet;

  @Column()
  walletId: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  operation: StellarWalletOperationType;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
