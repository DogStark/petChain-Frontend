import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainSync, SyncStatus, RecordType } from './entities/blockchain-sync.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { IPFSService } from './ipfs.service';
import { StellarService } from './stellar.service';

@Injectable()
export class BlockchainSyncService {
  private readonly logger = new Logger(BlockchainSyncService.name);

  constructor(
    @InjectRepository(BlockchainSync)
    private readonly syncRepository: Repository<BlockchainSync>,
    private readonly encryptionService: EncryptionService,
    private readonly ipfsService: IPFSService,
    private readonly stellarService: StellarService,
  ) {}

  async syncRecord(recordId: string, recordType: RecordType, data: any): Promise<BlockchainSync> {
    const recordHash = this.encryptionService.generateHash(data);
    
    let sync = await this.syncRepository.findOne({ where: { recordId, recordType } });
    if (!sync) {
      sync = this.syncRepository.create({
        recordId,
        recordType,
        recordHash,
        status: SyncStatus.PENDING,
      });
    } else {
      sync.recordHash = recordHash;
      sync.status = SyncStatus.PENDING;
    }
    
    await this.syncRepository.save(sync);

    try {
      // 1. Encrypt Data
      const encryptedData = this.encryptionService.encrypt(data);

      // 2. Upload to IPFS
      const ipfsHash = await this.ipfsService.upload(encryptedData);
      sync.ipfsHash = ipfsHash;

      // 3. Anchor on Stellar
      const txHash = await this.stellarService.anchorRecord(recordHash, ipfsHash);
      sync.txHash = txHash;
      
      sync.status = SyncStatus.SYNCED;
      sync.syncedAt = new Date();
      sync.lastError = null;
    } catch (error) {
      this.logger.error(`Sync failed for record ${recordId}: ${error.message}`);
      sync.status = SyncStatus.FAILED;
      sync.lastError = error.message;
      sync.retryCount += 1;
    }

    return await this.syncRepository.save(sync);
  }

  async verifyRecord(recordId: string, recordType: RecordType, currentData: any): Promise<any> {
    const sync = await this.syncRepository.findOne({ where: { recordId, recordType } });
    if (!sync || sync.status !== SyncStatus.SYNCED) {
      throw new NotFoundException('Record not synced or sync pending');
    }

    const currentHash = this.encryptionService.generateHash(currentData);
    
    // 1. Verify hash against local DB
    const integrityMatchesLocal = currentHash === sync.recordHash;

    // 2. Verify hash against Stellar
    const onChainIPFSHash = await this.stellarService.verifyOnChain(sync.recordHash);
    const integrityMatchesChain = onChainIPFSHash === sync.ipfsHash;

    // 3. Retrieve and Decrypt from IPFS (Optional but good for full verification)
    const ipfsData = await this.ipfsService.retrieve(sync.ipfsHash);
    const decryptedData = this.encryptionService.decrypt(ipfsData);
    const ipfsHashMatches = this.encryptionService.generateHash(JSON.parse(decryptedData)) === sync.recordHash;

    return {
      recordId,
      status: 'verified',
      integrity: {
        local: integrityMatchesLocal,
        blockchain: integrityMatchesChain,
        ipfs: ipfsHashMatches,
      },
      syncedAt: sync.syncedAt,
      txHash: sync.txHash,
    };
  }

  async getSyncStatus(recordId: string): Promise<BlockchainSync> {
    const sync = await this.syncRepository.findOne({ where: { recordId } });
    if (!sync) {
      throw new NotFoundException(`Sync status not found for record ${recordId}`);
    }
    return sync;
  }
}
