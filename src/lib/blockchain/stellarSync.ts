import * as StellarSdk from '@stellar/stellar-sdk';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed' | 'retrying';

export interface MedicalRecord {
  id: string;
  petId: string;
  type: 'vaccination' | 'treatment' | 'diagnosis' | 'prescription';
  data: Record<string, unknown>;
  timestamp: string;
  critical: boolean;
}

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
  private server: StellarSdk.Horizon.Server;
  private syncQueue: Map<string, SyncResult> = new Map();
  private maxRetries = 3;

  constructor() {
    const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'public';
    this.server = new StellarSdk.Horizon.Server(
      isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
    );
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

  private async estimateFee(): Promise<string> {
    try {
      const feeStats = await this.server.feeStats();
      return feeStats.fee_charged.mode;
    } catch {
      return StellarSdk.BASE_FEE;
    }
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

      const account = await this.server.loadAccount(sourceKeypair.publicKey());
      const fee = await this.estimateFee();

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.manageData({
            name: `pet_${record.petId}_${record.type}`,
            value: dataHash,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      const txResponse = await this.server.submitTransaction(transaction);

      result.txHash = txResponse.hash;
      result.status = 'success';
      result.fee = fee;
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
    
    await new Promise(resolve => setTimeout(resolve, 2000 * previousResult.attempts));
    
    await this.syncRecord(record, sourceKeypair, encryptionKey);
  }

  async verifyRecord(recordId: string): Promise<boolean> {
    try {
      const syncResult = this.syncQueue.get(recordId);
      
      if (!syncResult?.txHash) return false;

      const tx = await this.server.transactions().transaction(syncResult.txHash).call();
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

export const stellarSync = new StellarSyncService();
