import { useState, useCallback } from 'react';
import { transactionAPI, Transaction, TransactionType, TransactionFilters } from '@/lib/api/transactionAPI';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (filters?: TransactionFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionAPI.getTransactionHistory(filters);
      setTransactions(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.getTransactionById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const retryTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await transactionAPI.retryFailedTransaction(id);
      setTransactions(prev => prev.map(tx => tx.id === id ? result : tx));
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await transactionAPI.cancelPendingTransaction(id);
      setTransactions(prev => prev.filter(tx => tx.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const estimateCost = useCallback(async (type: TransactionType, data?: any) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.estimateTransactionCost(type, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate cost');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    getTransaction,
    retryTransaction,
    cancelTransaction,
    estimateCost,
  };
}
