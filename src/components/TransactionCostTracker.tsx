import { useEffect, useState } from 'react';
import { transactionAPI } from '@/lib/api/transactionAPI';

export default function TransactionCostTracker() {
  const [costs, setCosts] = useState({
    totalFees: '0',
    totalTransactions: 0,
    averageFee: '0',
    estimatedUSD: 0,
  });
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    loadCosts();
  }, [period]);

  const loadCosts = async () => {
    try {
      const now = new Date();
      let startDate: string | undefined;

      if (period === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (period === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const data = await transactionAPI.getTotalCosts(startDate);
      setCosts(data);
    } catch (error) {
      console.error('Failed to load costs:', error);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Transaction Costs</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | 'all')}
          className="border rounded px-3 py-1"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-600">Total Fees</p>
          <p className="text-2xl font-bold">{costs.totalFees} XLM</p>
          {costs.estimatedUSD > 0 && (
            <p className="text-sm text-gray-500">≈ ${costs.estimatedUSD.toFixed(2)}</p>
          )}
        </div>

        <div className="p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">Total Transactions</p>
          <p className="text-2xl font-bold">{costs.totalTransactions}</p>
        </div>

        <div className="p-4 bg-purple-50 rounded col-span-2">
          <p className="text-sm text-gray-600">Average Fee</p>
          <p className="text-2xl font-bold">{costs.averageFee} XLM</p>
        </div>
      </div>
    </div>
  );
}
