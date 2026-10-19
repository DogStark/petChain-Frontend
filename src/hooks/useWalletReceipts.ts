import { useState, useCallback, useEffect } from 'react';
import { receiptService, type ReceiptService } from '@/lib/wallet/receiptService';
import type { WalletReceipt, ReceiptFilter, WalletIntent } from '@/lib/wallet/walletReceipts';
import type { Transaction } from '@/lib/api/transactionAPI';

export function useWalletReceipts() {
  const [receipts, setReceipts] = useState<WalletReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load receipts on mount
  useEffect(() => {
    refreshReceipts();
  }, []);

  const refreshReceipts = useCallback((filter?: ReceiptFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = receiptService.query(filter);
      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, []);

  const getReceipt = useCallback((idOrHash: string): WalletReceipt | null => {
    return receiptService.getReceipt(idOrHash);
  }, []);

  const createReceipt = useCallback(
    (intent: WalletIntent, options?: {
      broadcastResult?: any;
      error?: Error;
      network?: 'TESTNET' | 'PUBLIC';
      isMultiOperation?: boolean;
      operationIndex?: number;
      operationCount?: number;
      parentReceiptId?: string;
    }): WalletReceipt => {
      const receipt = receiptService.createAndSave({
        intent,
        broadcastResult: options?.broadcastResult,
        error: options?.error,
        network: options?.network ?? 'TESTNET',
        isMultiOperation: options?.isMultiOperation,
        operationIndex: options?.operationIndex,
        operationCount: options?.operationCount,
        parentReceiptId: options?.parentReceiptId,
      });
      refreshReceipts();
      return receipt;
    },
    [refreshReceipts]
  );

  const updateReceipt = useCallback(
    (id: string, tx: Transaction): WalletReceipt | null => {
      const updated = receiptService.updateReceipt(id, tx);
      if (updated) {
        setReceipts((prev) =>
          prev.map((r) => (r.id === id ? updated : r))
        );
      }
      return updated;
    },
    []
  );

  const deleteReceipt = useCallback((id: string) => {
    receiptService.deleteReceipt(id);
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    receiptService.clearReceipts();
    setReceipts([]);
  }, []);

  const getAttentionRequired = useCallback((): WalletReceipt[] => {
    return receiptService.getAttentionRequired();
  }, []);

  const getMultiOperationGroups = useCallback(() => {
    return receiptService.getMultiOperationGroups();
  }, []);

  return {
    receipts,
    loading,
    error,
    refreshReceipts,
    getReceipt,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    clearAll,
    getAttentionRequired,
    getMultiOperationGroups,
  };
}