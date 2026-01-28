import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Wallet } from './wallet.entity';

export type WalletOperationType =
  | 'CREATE'
  | 'ROTATE_KEY'
  | 'PREPARE_TRANSACTION'
  | 'SIGN_TRANSACTION'
  | 'SUBMIT_TRANSACTION'
  | 'BACKUP_EXPORT'
  | 'RECOVERY_REQUEST';

@Entity('wallet_audit_logs')
export class WalletAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.auditLogs, { nullable: false })
  wallet: Wallet;

  @Column()
  walletId: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  operation: WalletOperationType;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
