import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsDateString,
} from 'class-validator';

/**
 * DTO for verifying a zero-knowledge proof.
 *
 * Two verification modes are supported:
 *  1. By proofId — look up a stored proof and re-verify it.
 *  2. By raw proof data — verify a proof submitted inline (e.g. from an
 *     external verifier that received only the public outputs).
 *
 * @example
 * // Mode 1 – verify by ID
 * { "proofId": "550e8400-e29b-41d4-a716-446655440000" }
 *
 * @example
 * // Mode 2 – verify inline
 * {
 *   "proof": "a3f1...",
 *   "commitment": "9c2b...",
 *   "publicInputs": { "petId": "...", "vaccineName": "Rabies", "isValid": true }
 * }
 */
export class VerifyProofDto {
  /** UUID of a previously stored proof (mode 1). */
  @IsOptional()
  @IsUUID()
  proofId?: string;

  /**
   * Raw cryptographic proof string (Groth16 π_A/π_B/π_C hex in production).
   * Required for inline verification (mode 2).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  proof?: string;

  /**
   * HMAC commitment to the private witness.
   * Required for inline verification (mode 2).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  commitment?: string;

  /**
   * Public inputs that were exposed during proof generation.
   * Required for inline verification (mode 2).
   */
  @IsOptional()
  @IsObject()
  publicInputs?: Record<string, unknown>;

  /**
   * Optional ISO-8601 timestamp; if provided the verifier will reject proofs
   * whose expiresAt is before this value (defaults to now).
   */
  @IsOptional()
  @IsDateString()
  verifyAt?: string;
}
