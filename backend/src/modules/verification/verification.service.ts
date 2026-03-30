// @ts-nocheck
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerificationResult,
  VerificationStatus,
} from './entities/verification-result.entity';
import { VerificationAudit } from './entities/verification-audit.entity';
import { BlockchainSyncService } from '../blockchain/blockchain-sync.service';
import { MedicalRecordsService } from '../medical-records/medical-records.service';
import { StellarService } from '../blockchain/stellar.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { ContractInteractionService } from '../blockchain/contract-interaction.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache

  constructor(
    @InjectRepository(VerificationResult)
    private readonly resultRepository: Repository<VerificationResult>,
    @InjectRepository(VerificationAudit)
    private readonly auditRepository: Repository<VerificationAudit>,
    private readonly syncService: BlockchainSyncService,
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly stellarService: StellarService,
    private readonly encryptionService: EncryptionService,
    private readonly contractInteraction: ContractInteractionService,
  ) {}

  async verifyRecord(
    recordId: string,
    recordType: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<VerificationResult> {
    // 0. On-chain Access Control Check
    if (userId) {
      const hasAccess = await this.contractInteraction.checkAccess(
        recordId,
        userId,
      );
      if (!hasAccess) {
        this.logger.warn(
          `User ${userId} attempted to verify record ${recordId} without on-chain permission.`,
        );
        throw new Error('Access denied by Stellar Smart Contract');
      }
    }

    // 1. Check cache
    const cached = await this.resultRepository.findOne({ where: { recordId } });
    const now = new Date();

    if (
      cached &&
      cached.lastVerifiedAt &&
      now.getTime() - cached.lastVerifiedAt.getTime() < this.CACHE_TTL_MS
    ) {
      this.logger.log(`Returning cached verification for record ${recordId}`);
      await this.logAudit(
        recordId,
        userId,
        cached.status,
        ipAddress,
        'Cached result returned',
      );
      return cached;
    }

    // 2. Perform Real-time Verification
    const record = await this.medicalRecordsService.findOne(recordId);
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    // Use verifyRecord from syncService for core logic
    const syncResult = await this.syncService.verifyRecord(
      recordId,
      recordType as any,
      record,
    );

    let status = VerificationStatus.VERIFIED;
    if (
      !syncResult.integrity.blockchain ||
      !syncResult.integrity.local ||
      !syncResult.integrity.ipfs
    ) {
      status = VerificationStatus.TAMPERED;
    }

    // 3. Update/Create Cache
    let result = cached;
    if (!result) {
      result = this.resultRepository.create({ recordId, recordType });
    }

    result.status = status;
    result.integrityDetails = {
      localMatch: syncResult.integrity.local,
      blockchainMatch: syncResult.integrity.blockchain,
      ipfsMatch: syncResult.integrity.ipfs,
    };
    result.txHash = syncResult.txHash;
    result.lastVerifiedAt = now;

    await this.resultRepository.save(result);

    // 4. Log Audit
    await this.logAudit(
      recordId,
      userId,
      status,
      ipAddress,
      JSON.stringify(syncResult.integrity),
    );

    return result;
  }

  async verifyBatch(
    recordIds: string[],
    recordType: string,
    userId?: string,
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    for (const id of recordIds) {
      try {
        const res = await this.verifyRecord(id, recordType, userId);
        results.push(res);
      } catch (error) {
        this.logger.error(
          `Batch verification failed for ${id}: ${error.message}`,
        );
      }
    }
    return results;
  }

  async getTransactionHistory(recordId: string) {
    const sync = await this.syncService.getSyncStatus(recordId);
    if (!sync || !sync.txHash) {
      throw new NotFoundException(
        `No transaction history found for record ${recordId}`,
      );
    }

    // In a real scenario, we might want to fetch more details from Horizon
    // For now, return the basic sync info which includes the txHash
    return {
      recordId,
      txHash: sync.txHash,
      ipfsHash: sync.ipfsHash,
      syncedAt: sync.syncedAt,
      status: sync.status,
    };
  }

  async getAuditTrail(recordId: string): Promise<VerificationAudit[]> {
    return await this.auditRepository.find({
      where: { recordId },
      order: { verifiedAt: 'DESC' },
    });
  }

  private async logAudit(
    recordId: string,
    userId: string | undefined,
    result: string,
    ipAddress?: string,
    details?: string,
  ) {
    const audit = this.auditRepository.create({
      recordId,
      userId,
      result,
      verifiedAt: new Date(),
      ipAddress,
      details,
    });
    await this.auditRepository.save(audit);
  }
}
