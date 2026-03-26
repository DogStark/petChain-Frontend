import * as StellarSdk from '@stellar/stellar-sdk';
import { stellarService, StellarService, MedicalRecord, TransactionResult } from './index';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed' | 'retrying';

export interface SyncResult {
  recordId: string;
  txHash?: string;
  status: SyncStatus;
  ipfsHash?: string;
  error?: string;
  attempts: number;
  fee: string;
}

class StellarSyncService {
  private engine: StellarService;
  private syncQueue: Map<string, SyncResult> = new Map();
  private maxRetries = 3;

  constructor(engine: StellarService = stellarService) {
    this.engine = engine;
  }

  private encrypt(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    return Buffer.from(str).toString('base64');
  }

  private async uploadToIPFS(data: string): Promise<string> {
    const ipfsEndpoint = process.env.NEXT_PUBLIC_IPFS_ENDPOINT || 'https://ipfs.infura.io:5001';
    const response = await fetch(`${ipfsEndpoint}/api/v0/add`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.Hash;
  }

  private shouldSyncToBlockchain(record: MedicalRecord): boolean {
    return record.critical || ['vaccination', 'diagnosis'].includes(record.type);
  }

  async syncRecord(
    record: MedicalRecord,
    sourceKeypair: StellarSdk.Keypair,
    encryptionKey: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      recordId: record.id,
      status: 'syncing',
      attempts: 0,
      fee: '0',
    };

    this.syncQueue.set(record.id, result);

    if (!this.shouldSyncToBlockchain(record)) {
      result.status = 'success';
      return result;
    }

    try {
      const encrypted = this.encrypt(record.data);
      const dataSize = Buffer.from(encrypted).length;
      
      let dataHash: string;
      if (dataSize > 1024) {
        dataHash = await this.uploadToIPFS(encrypted);
        result.ipfsHash = dataHash;
      } else {
        dataHash = encrypted.substring(0, 64);
      }

      // Use the new StellarService building and submission logic
      const operation = StellarSdk.Operation.manageData({
        name: `pet_${record.petId}_${record.type}`,
        value: dataHash,
      });

      const transaction = await this.engine.buildTransaction(sourceKeypair.publicKey(), [operation]);
      transaction.sign(sourceKeypair);

      const txResult: TransactionResult = await this.engine.submitTransaction(transaction);

      if (txResult.success) {
        result.txHash = txResult.hash;
        result.status = 'success';
        result.fee = txResult.feeCharged || '0';
      } else {
        throw new Error(txResult.error);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.status = 'failed';
      
      if (result.attempts < this.maxRetries) {
        await this.retrySync(record, sourceKeypair, encryptionKey, result);
      }
    }

    this.syncQueue.set(record.id, result);
    return result;
  }

  private async retrySync(
    record: MedicalRecord,
    sourceKeypair: StellarSdk.Keypair,
    encryptionKey: string,
    previousResult: SyncResult
  ): Promise<void> {
    previousResult.attempts++;
    previousResult.status = 'retrying';
    
    // Waiting logic is already somewhat handled in StellarService.submitTransaction,
    // but this higher-level retry handles record-specific failures (like IPFS issues).
    await new Promise(resolve => setTimeout(resolve, 2000 * previousResult.attempts));
    
    await this.syncRecord(record, sourceKeypair, encryptionKey);
  }

  async verifyRecord(recordId: string): Promise<boolean> {
    try {
      const syncResult = this.syncQueue.get(recordId);
      if (!syncResult?.txHash) return false;

      // Access the Horizon server via the engine for consistency
      const server = (this.engine as any).server || new StellarSdk.Horizon.Server(process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
      const tx = await server.transactions().transaction(syncResult.txHash).call();
      return tx.successful;
    } catch {
      return false;
    }
  }

  getSyncStatus(recordId: string): SyncResult | undefined {
    return this.syncQueue.get(recordId);
  }

  getAllSyncStatuses(): SyncResult[] {
    return Array.from(this.syncQueue.values());
  }
}

export { MedicalRecord };
export const stellarSync = new StellarSyncService();
