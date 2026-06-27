import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Supported proof types for zero-knowledge proof generation.
 *
 * - `vaccination_validity`: Proves a vaccination record exists and has not expired,
 *   without revealing the vaccination date, batch number, or veterinarian details.
 * - `age_range`: Proves a pet's age falls within a specified range without
 *   revealing the exact date of birth.
 * - `ownership`: Proves the requesting user owns the pet without revealing
 *   the full ownership history.
 */
export enum ProofType {
  VACCINATION_VALIDITY = 'vaccination_validity',
  AGE_RANGE = 'age_range',
  OWNERSHIP = 'ownership',
}

/**
 * Data Transfer Object for generating a zero-knowledge proof.
 *
 * A ZK proof allows a pet owner or veterinarian to cryptographically prove
 * a claim about a vaccination record (e.g. "this vaccination is valid and
 * has not expired") without exposing the underlying private data such as
 * the exact administration date, batch number, or veterinarian identity.
 *
 * The proof is generated server-side using a simulated Groth16 scheme
 * (HMAC-SHA256 commitment + SHA256 proof hash). In production this will be
 * replaced with a real snarkjs circuit once the compiled `.wasm` and `.zkey`
 * artifacts are available.
 *
 * @example
 * // Minimal — prove vaccination validity with a 30-day default expiry
 * {
 *   "vaccinationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 * }
 *
 * @example
 * // Full — custom expiry, specific proof type, and a human-readable purpose
 * {
 *   "vaccinationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
 *   "expiresAt": "2026-12-31T23:59:59.000Z",
 *   "proofType": "vaccination_validity",
 *   "includePublicInputs": true,
 *   "purpose": "Border crossing health certificate verification"
 * }
 */
export class GenerateProofDto {
  /**
   * UUID of the vaccination record for which the proof is generated.
   *
   * The vaccination must belong to a pet owned by (or shared with) the
   * authenticated user. The service will throw `NotFoundException` if the
   * record does not exist or is not accessible.
   *
   * @example "3fa85f64-5717-4562-b3fc-2c963f66afa6"
   */
  @IsUUID()
  vaccinationId: string;

  /**
   * ISO 8601 datetime string after which the proof is considered expired.
   *
   * If omitted, the proof expires 30 days from the time of generation.
   * Expired proofs return `{ valid: false }` on verification without
   * re-running the cryptographic check.
   *
   * @example "2026-12-31T23:59:59.000Z"
   */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /**
   * The type of claim being proven.
   *
   * Defaults to `vaccination_validity` when omitted.
   *
   * @example "vaccination_validity"
   */
  @IsOptional()
  @IsEnum(ProofType)
  proofType?: ProofType;

  /**
   * When `true`, the response includes the `publicInputs` object alongside
   * the proof hash. Public inputs contain only non-sensitive fields
   * (e.g. `petId`, `vaccineName`, `isValid`) and are safe to share with
   * third-party verifiers.
   *
   * Defaults to `false`.
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  includePublicInputs?: boolean;

  /**
   * Human-readable description of why this proof is being generated.
   *
   * Stored in the audit log for compliance purposes. Maximum 255 characters.
   *
   * @example "Border crossing health certificate verification"
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  purpose?: string;
}
