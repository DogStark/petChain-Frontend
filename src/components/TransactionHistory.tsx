import { useEffect, useState } from 'react';
import { transactionAPI, Transaction, TransactionFilters, TransactionStatus, TransactionType } from '@/lib/api/transactionAPI';

const statusColors: Record<TransactionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({});

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionAPI.getTransactionHistory(filters);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await transactionAPI.retryFailedTransaction(id);
      loadTransactions();
    } catch (error) {
      console.error('Failed to retry transaction:', error);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
      
      <div className="mb-4 flex gap-2">
        <select
          onChange={(e) => setFilters({ ...filters, status: e.target.value as TransactionStatus || undefined })}
          className="border rounded px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="failed">Failed</option>
        </select>
        
        <select
          onChange={(e) => setFilters({ ...filters, type: e.target.value as TransactionType || undefined })}
          className="border rounded px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="record_creation">Record Creation</option>
          <option value="record_update">Record Update</option>
          <option value="vaccination">Vaccination</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Hash</th>
              <th className="px-4 py-2 border">Type</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">Fee</th>
              <th className="px-4 py-2 border">Time</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
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
                <td className="px-4 py-2 border">
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2 border">
                  {tx.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(tx.id)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
