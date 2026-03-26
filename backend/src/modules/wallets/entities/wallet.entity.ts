import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WalletAuditLog } from './wallet-audit-log.entity';

export type WalletNetwork = 'PUBLIC' | 'TESTNET';
export type WalletKeyDerivation = 'PBKDF2' | 'ARGON2';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Column()
  userId: string;

  @Column({ unique: true })
  publicKey: string;

  /**
   * Encrypted private key blob.
   * The server should only ever store ciphertext – never plaintext keys.
   */
  @Column({ type: 'text', nullable: true })
  encryptedSecretKey: string | null;

  /**
   * Parameters used to derive the encryption key from the user's password.
   * The actual password-derived key is NEVER stored.
   */
  @Column({ type: 'varchar', length: 16 })
  encryptionIv: string;

  @Column({ type: 'varchar', length: 64 })
  encryptionSalt: string;

  @Column({ type: 'varchar', length: 16 })
  keyDerivation: WalletKeyDerivation;

  @Column({ type: 'varchar', length: 16 })
  network: WalletNetwork;

  /**
   * Optional HSM reference for institutional deployments.
   * When set, private keys are expected to live in the HSM, not in encryptedSecretKey.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  hsmKeyId: string | null;

  @Column({ default: false })
  isMultiSig: boolean;

  /**
   * Multi-sig configuration snapshot (weights, thresholds, signer public keys).
   * This is a convenience cache; on-chain config is the source of truth.
   */
  @Column({ type: 'jsonb', nullable: true })
  multisigConfig: Record<string, unknown> | null;

  /**
   * Bumps whenever keys are rotated for this wallet.
   */
  @Column({ type: 'int', default: 1 })
  rotationVersion: number;

  @OneToMany(() => WalletAuditLog, (log) => log.wallet)
  auditLogs: WalletAuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
