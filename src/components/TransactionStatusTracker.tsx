import { useEffect, useRef, useState } from 'react';
import { transactionAPI, Transaction } from '@/lib/api/transactionAPI';

const BASE_INTERVAL = 10_000;
const MAX_INTERVAL = 160_000;

export default function TransactionStatusTracker() {
  const [pending, setPending] = useState<Transaction[]>([]);
  const [failed, setFailed] = useState<Transaction[]>([]);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(BASE_INTERVAL);

  const scheduleNext = (delay: number) => {
    if (intervalRef.current) clearTimeout(intervalRef.current);
    intervalRef.current = setTimeout(poll, delay);
  };

  const poll = async () => {
    try {
      const [pendingTxs, failedTxs] = await Promise.all([
        transactionAPI.getPendingTransactions(),
        transactionAPI.getFailedTransactions(),
      ]);
      setPending(pendingTxs);
      setFailed(failedTxs);
      delayRef.current = BASE_INTERVAL; // reset on success
    } catch (error) {
      console.error('Failed to load transaction status:', error);
      delayRef.current = Math.min(delayRef.current * 2, MAX_INTERVAL); // backoff
    }
    scheduleNext(delayRef.current);
  };

  useEffect(() => {
    poll();
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      await Promise.all([
        fetchPendingTransactions(),
        fetchFailedTransactions(),
      ]);
    } catch (error) {
      console.error('Failed to load transaction status:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelTransaction(id);
      await loadTransactions();
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryTransaction(id);
      await loadTransactions();
    } catch (error) {
      console.error('Failed to retry transaction:', error);
    }
  };

  if (pending.length === 0 && failed.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white shadow-lg rounded-lg border">
      <div className="p-4">
        <h3 className="font-semibold mb-3">Transaction Status</h3>

        {pending.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-2">Pending ({pending.length})</p>
            {pending.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2 bg-yellow-50 rounded mb-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{tx.type}</p>
                  <p className="text-xs text-gray-500">{tx.hash.substring(0, 10)}...</p>
                </div>
                <button
                  onClick={() => handleCancel(tx.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {failed.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Failed ({failed.length})</p>
            {failed.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2 bg-red-50 rounded mb-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{tx.type}</p>
                  <p className="text-xs text-gray-500">{tx.errorMessage || 'Unknown error'}</p>
                </div>
                <button
                  onClick={() => handleRetry(tx.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
