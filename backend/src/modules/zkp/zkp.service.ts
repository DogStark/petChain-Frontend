import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ZkpProof } from './entities/zkp-proof.entity';
import { GenerateProofDto } from './dto/generate-proof.dto';
import { VerifyProofDto } from './dto/verify-proof.dto';
import { VaccinationsService } from '../vaccinations/vaccinations.service';

/**
 * ZKP Service — simulates a Groth16-style proof without native circom/snarkjs binaries.
 *
 * In production, replace `_simulateProof` / `_simulateVerify` with actual
 * snarkjs calls once the compiled circuit artifacts are available.
 */
@Injectable()
export class ZkpService {
  private readonly logger = new Logger(ZkpService.name);

  constructor(
    @InjectRepository(ZkpProof)
    private readonly proofRepository: Repository<ZkpProof>,
    private readonly vaccinationsService: VaccinationsService,
  ) {}

  /** Generate a ZK proof that a vaccination record exists and is valid */
  async generateProof(dto: GenerateProofDto): Promise<ZkpProof> {
    const vaccination = await this.vaccinationsService.findOne(dto.vaccinationId);

    // Public inputs: only non-sensitive fields exposed to the verifier
    const publicInputs = {
      petId: vaccination.petId,
      vaccineName: vaccination.vaccineName,
      isValid: this._isVaccinationValid(vaccination),
      expiresAfter: vaccination.nextDueDate
        ? vaccination.nextDueDate.toISOString().split('T')[0]
        : null,
    };

    // Private witness: full record — never leaves this service
    const privateWitness = {
      vaccinationId: vaccination.id,
      administeredDate: vaccination.administeredDate,
      batchNumber: vaccination.batchNumber,
      veterinarianName: vaccination.veterinarianName,
      certificateCode: vaccination.certificateCode,
    };

    const { proof, commitment } = this._simulateProof(publicInputs, privateWitness);

    const entity = this.proofRepository.create({
      vaccinationId: vaccination.id,
      petId: vaccination.petId,
      publicInputs,
      proof,
      commitment,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : this._defaultExpiry(),
    });

    return this.proofRepository.save(entity);
  }

  /** Verify a previously generated proof without revealing private data */
  async verifyProof(dto: VerifyProofDto): Promise<{ valid: boolean; publicInputs: Record<string, unknown> }> {
    const record = await this.proofRepository.findOne({ where: { id: dto.proofId } });
    if (!record) throw new NotFoundException(`Proof ${dto.proofId} not found`);

    if (record.expiresAt && record.expiresAt < new Date()) {
      return { valid: false, publicInputs: record.publicInputs };
    }

    const valid = this._simulateVerify(record.publicInputs, record.proof, record.commitment);

    record.verifiedAt = new Date();
    record.isValid = valid;
    await this.proofRepository.save(record);

    this.logger.log(`Proof ${dto.proofId} verified: ${valid}`);

    // Return only public inputs — private witness is never exposed
    return { valid, publicInputs: record.publicInputs };
  }

  /** Get all proofs for a pet (public inputs only) */
  async getProofsForPet(petId: string): Promise<ZkpProof[]> {
    return this.proofRepository.find({ where: { petId }, order: { createdAt: 'DESC' } });
  }

  /** Revoke a proof */
  async revokeProof(proofId: string): Promise<void> {
    const record = await this.proofRepository.findOne({ where: { id: proofId } });
    if (!record) throw new NotFoundException(`Proof ${proofId} not found`);
    record.isValid = false;
    record.expiresAt = new Date();
    await this.proofRepository.save(record);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _isVaccinationValid(v: { nextDueDate: Date | null }): boolean {
    if (!v.nextDueDate) return true;
    return new Date(v.nextDueDate) > new Date();
  }

  /**
   * Simulates a Groth16 proof:
   *  - commitment = HMAC-SHA256(privateWitness, secret)
   *  - proof      = SHA256(publicInputs + commitment)
   *
   * Replace with `snarkjs.groth16.fullProve(input, wasmPath, zkeyPath)` once
   * circuit artifacts are compiled and bundled.
   */
  private _simulateProof(
    publicInputs: Record<string, unknown>,
    privateWitness: Record<string, unknown>,
  ): { proof: string; commitment: string } {
    const secret = process.env.ZKP_SECRET ?? 'zkp-dev-secret';
    const commitment = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(privateWitness))
      .digest('hex');

    const proof = crypto
      .createHash('sha256')
      .update(JSON.stringify(publicInputs) + commitment)
      .digest('hex');

    return { proof, commitment };
  }

  /**
   * Simulates Groth16 verification:
   *  - recompute proof from stored publicInputs + commitment
   *  - compare with stored proof
   *
   * Replace with `snarkjs.groth16.verify(vKey, publicSignals, proof)`.
   */
  private _simulateVerify(
    publicInputs: Record<string, unknown>,
    storedProof: string,
    commitment: string,
  ): boolean {
    const expected = crypto
      .createHash('sha256')
      .update(JSON.stringify(publicInputs) + commitment)
      .digest('hex');
    return expected === storedProof;
  }

  private _defaultExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }
}
