import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('mfa_configs')
@Index(['userId'], { unique: true })
export class MfaConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** TOTP secret (base32 encoded). Null until setup is completed. */
  @Column({ type: 'varchar', nullable: true })
  secret: string | null;

  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  /** Hashed backup codes (bcrypt). Array of 10 single-use codes. */
  @Column({ type: 'jsonb', default: [] })
  backupCodes: string[];

  /** Tracks which backup codes have been consumed. */
  @Column({ type: 'jsonb', default: [] })
  usedBackupCodes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
