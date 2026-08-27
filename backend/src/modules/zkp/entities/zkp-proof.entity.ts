import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('zkp_proofs')
export class ZkpProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vaccination_id' })
  vaccinationId: string;

  @Column({ name: 'pet_id' })
  petId: string;

  /** Non-sensitive public inputs exposed to verifiers */
  @Column({ type: 'jsonb', name: 'public_inputs' })
  publicInputs: Record<string, unknown>;

  /** Cryptographic proof string (Groth16 π_A, π_B, π_C in production) */
  @Column({ type: 'text' })
  proof: string;

  /** Commitment to the private witness */
  @Column({ type: 'text' })
  commitment: string;

  @Column({ default: true, name: 'is_valid' })
  isValid: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'verified_at' })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
