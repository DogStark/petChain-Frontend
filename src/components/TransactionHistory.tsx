import { useEffect, useState } from 'react';
import type {
  TransactionFilters,
  TransactionStatus,
  TransactionType,
} from '@/lib/api/transactionAPI';
import { useTransactions } from '@/hooks/useTransactions';
import { formatDateTime } from '@/utils/formatDate';
import { isTestnetNetwork } from '@/lib/blockchain/network';
import {
  downloadTransactionReceiptPdf,
  isReceiptEligibleTransaction,
} from '@/lib/wallet/transactionReceiptPdf';

const statusColors: Record<TransactionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function TransactionHistory() {
  const { transactions, loading, error, fetchTransactions, retryTransaction } = useTransactions();
  const [filters, setFilters] = useState<TransactionFilters>({});

  useEffect(() => {
    fetchTransactions(filters);
  }, [filters, fetchTransactions]);

  const handleRetry = async (id: string) => {
    try {
      await retryTransaction(id);
      await fetchTransactions(filters);
    } catch (error) {
      console.error('Failed to retry transaction:', error);
    }
  };

  if (loading) return <div className="p-4" role="status">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>

      <div className="mb-4 flex gap-2">
        <select
          onChange={(e) =>
            setFilters({ ...filters, status: (e.target.value as TransactionStatus) || undefined })
          }
          className="border rounded px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="failed">Failed</option>
        </select>

        <select
          onChange={(e) =>
            setFilters({ ...filters, type: (e.target.value as TransactionType) || undefined })
          }
          className="border rounded px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="record_creation">Record Creation</option>
          <option value="record_update">Record Update</option>
          <option value="vaccination">Vaccination</option>
        </select>
      </div>

      <div className="overflow--auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th scope="col" className="px-4 py-2 border">Hash</th>
              <th scope="col" className="px-4 py-2 border">Type</th>
              <th scope="col" className="px-4 py-2 border">Status</th>
              <th scope="col" className="px-4 py-2 border">Fee</th>
              <th scope="col" className="px-4 py-2 border">Time</th>
              <th scope="col" className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 border text-center text-sm text-gray-500">
                  {error ? (
                    <span role="alert">Unable to load transactions: {error}</span>
                  ) : (
                    'No transactions to display.'
                  )}
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border font-mono text-sm">
                  {tx.hash.substring(0, 10)}...
                </td>
                <td className="px-4 py-2 border">{tx.type}</td>
                <td className="px-4 py-2 border">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[tx.status]}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-2 border">{tx.fee} XLM</td>
                <td className="px-4 py-2 border">{formatDateTime(tx.timestamp)}</td>
                <td className="px-4 py-2 border">
                  {tx.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(tx.id)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Retry
                    </button>
                  )}
                  {tx.status === 'confirmed' && tx.type === 'transfer' && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadTransactionReceiptPdf(
                          tx,
                          isTestnetNetwork() ? 'TESTNET' : 'PUBLIC'
                        )
                      }
                      disabled={!isReceiptEligibleTransaction(tx)}
                      className="ml-2 text-blue-600 hover:underline text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                      aria-label={`Download PDF receipt for transaction ${tx.hash}`}
                      title={
                        isReceiptEligibleTransaction(tx)
                          ? 'Download PDF receipt'
                          : 'Receipt unavailable without a confirmed ledger and transaction hash'
                      }
                    >
                      Download receipt PDF
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && transactions.length > 0 && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Unable to refresh transactions: {error}
        </p>
      )}
    </div>
  );
}
