import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';

export enum ProofStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/**
 * Stores zero-knowledge proofs generated for pet vaccination records.
 *
 * Only public inputs are persisted; the private witness never leaves the
 * ZkpService and is never stored in the database.
 */
@Entity('zkp_proofs')
@Index('idx_zkp_proofs_pet_id', ['petId'])
@Index('idx_zkp_proofs_vaccination_id', ['vaccinationId'])
@Index('idx_zkp_proofs_status', ['status'])
@Index('idx_zkp_proofs_expires_at', ['expiresAt'])
@Check(`"expires_at" IS NULL OR "expires_at" > "created_at"`)
export class ZkpProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK to the vaccination record this proof attests to. */
  @Column({ name: 'vaccination_id' })
  vaccinationId: string;

  /** FK to the pet that owns the vaccination record. */
  @Column({ name: 'pet_id' })
  petId: string;

  /**
   * Non-sensitive public inputs exposed to verifiers.
   * Contains fields such as petId, vaccineName, isValid, expiresAfter.
   */
  @Column({ type: 'jsonb', name: 'public_inputs' })
  publicInputs: Record<string, unknown>;

  /**
   * Cryptographic proof string.
   * In production: Groth16 π_A, π_B, π_C encoded as hex/base64.
   * In simulation: SHA-256(publicInputs + commitment).
   */
  @Column({ type: 'text' })
  proof: string;

  /**
   * HMAC-SHA256 commitment to the private witness.
   * Allows re-verification without storing the witness itself.
   */
  @Column({ type: 'text' })
  commitment: string;

  /** Current lifecycle status of the proof. */
  @Column({
    type: 'enum',
    enum: ProofStatus,
    default: ProofStatus.PENDING,
  })
  status: ProofStatus;

  /** Convenience flag; kept in sync with status for fast boolean queries. */
  @Column({ default: true, name: 'is_valid' })
  isValid: boolean;

  /** Proof expires at this timestamp; null means no expiry. */
  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;

  /** Timestamp of the most recent verification attempt. */
  @Column({ type: 'timestamptz', nullable: true, name: 'verified_at' })
  verifiedAt: Date | null;

  /** Timestamp when the proof was revoked, if applicable. */
  @Column({ type: 'timestamptz', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
