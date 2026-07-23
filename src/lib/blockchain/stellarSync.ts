import * as StellarSdk from '@stellar/stellar-sdk';

import { stellarService } from './index';
import type { StellarService, TransactionResult } from './index';
import type { MedicalRecord } from './types';
import { computeChecksum } from '../wallet/walletCrypto';

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

  private async encrypt(data: Record<string, unknown>, encryptionKey: string): Promise<{ ciphertext: string; iv: string }> {
    const plaintext = JSON.stringify(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );

    return {
      ciphertext: Buffer.from(cipherBuffer).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
    };
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
    encryptionKey: string,
    existingResult?: SyncResult
  ): Promise<SyncResult> {
    const result: SyncResult = existingResult || {
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
      const encrypted = await this.encrypt(record.data, encryptionKey);
      const encryptedPayload = encrypted.ciphertext;
      const dataSize = Buffer.from(encryptedPayload).length;

      let dataHash: string;
      if (dataSize > 1024) {
        await this.uploadToIPFS(encryptedPayload);
        dataHash = await computeChecksum(encryptedPayload);
        result.ipfsHash = dataHash;
      } else {
        dataHash = await computeChecksum(encryptedPayload);
      }

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

    const backoffMs = 2000 * previousResult.attempts;
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    await this.syncRecord(record, sourceKeypair, encryptionKey, previousResult);
  }

  async verifyRecord(recordId: string, currentData?: Record<string, unknown>): Promise<boolean> {
    try {
      const syncResult = this.syncQueue.get(recordId);
      if (!syncResult?.txHash) return false;

      const server = this.engine.getServer();
      const tx = await server.transactions().transaction(syncResult.txHash).call();

      if (!tx.successful) return false;

      if (currentData) {
        const currentHash = await computeChecksum(JSON.stringify(currentData));
        const storedHash = syncResult.ipfsHash || '';
        return currentHash === storedHash;
      }

      return true;
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

export type { MedicalRecord };
export const stellarSync = new StellarSyncService();
