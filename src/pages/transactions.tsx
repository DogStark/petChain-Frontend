import { useState } from 'react';
import TransactionHistory from '@/components/TransactionHistory';
import TransactionDetails from '@/components/TransactionDetails';
import TransactionStatusTracker from '@/components/TransactionStatusTracker';
import TransactionCostTracker from '@/components/TransactionCostTracker';

export default function TransactionsPage() {
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Blockchain Transactions</h1>
        
        <div className="mb-6">
          <TransactionCostTracker />
        </div>

        <TransactionHistory />
        
        {selectedTxId && (
          <TransactionDetails
            transactionId={selectedTxId}
            onClose={() => setSelectedTxId(null)}
          />
        )}

        <TransactionStatusTracker />
      </div>
    </div>
  );
}
