import { useState, useEffect } from 'react';
import { stellarSync, MedicalRecord, SyncResult } from '@/lib/blockchain/stellarSync';
import * as StellarSdk from '@stellar/stellar-sdk';

export const useBlockchainSync = () => {
  const [syncStatuses, setSyncStatuses] = useState<SyncResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatuses(stellarSync.getAllSyncStatuses());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const syncRecord = async (record: MedicalRecord, secretKey: string, encryptionKey: string) => {
    setIsLoading(true);
    setSyncError(null);

    try {
      const keypair = StellarSdk.Keypair.fromSecret(secretKey);
      const result = await stellarSync.syncRecord(record, keypair, encryptionKey);
      setSyncStatuses(stellarSync.getAllSyncStatuses());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown blockchain sync error';
      setSyncError(message);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyRecord = async (recordId: string) => {
    return await stellarSync.verifyRecord(recordId);
  };

  const getStatus = (recordId: string) => {
    return stellarSync.getSyncStatus(recordId);
  };

  return {
    syncRecord,
    verifyRecord,
    getStatus,
    syncStatuses,
    isLoading,
    syncError,
  };
};
