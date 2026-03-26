import { useEffect, useState } from 'react';
import { transactionAPI, Transaction, TransactionReceipt, TransactionCost } from '@/lib/api/transactionAPI';

interface TransactionDetailsProps {
  transactionId: string;
  onClose: () => void;
}

export default function TransactionDetails({ transactionId, onClose }: TransactionDetailsProps) {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [cost, setCost] = useState<TransactionCost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactionDetails();
  }, [transactionId]);

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);
      const [txData, receiptData, costData] = await Promise.all([
        transactionAPI.getTransactionById(transactionId),
        transactionAPI.getTransactionReceipt(transactionId).catch(() => null),
        transactionAPI.getTransactionCost(transactionId).catch(() => null),
      ]);
      setTransaction(txData);
      setReceipt(receiptData);
      setCost(costData);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!transaction) return <div className="p-4">Transaction not found</div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Transaction Details</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-semibold">Hash:</label>
              <p className="font-mono text-sm break-all">{transaction.hash}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Status:</label>
                <p className="capitalize">{transaction.status}</p>
              </div>
              <div>
                <label className="font-semibold">Type:</label>
                <p>{transaction.type}</p>
              </div>
            </div>

            <div>
              <label className="font-semibold">From:</label>
              <p className="font-mono text-sm">{transaction.fromAddress}</p>
            </div>

            {transaction.toAddress && (
              <div>
                <label className="font-semibold">To:</label>
                <p className="font-mono text-sm">{transaction.toAddress}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Fee:</label>
                <p>{transaction.fee} XLM</p>
              </div>
              {transaction.blockNumber && (
                <div>
                  <label className="font-semibold">Block:</label>
                  <p>{transaction.blockNumber}</p>
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold">Timestamp:</label>
              <p>{new Date(transaction.timestamp).toLocaleString()}</p>
            </div>

            {cost && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Cost Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Base Fee:</span>
                    <span>{cost.baseFee} XLM</span>
                  </div>
                  {cost.priorityFee && (
                    <div className="flex justify-between">
                      <span>Priority Fee:</span>
                      <span>{cost.priorityFee} XLM</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{cost.totalFee} XLM</span>
                  </div>
                  {cost.estimatedUSD && (
                    <div className="flex justify-between text-gray-600">
                      <span>USD Estimate:</span>
                      <span>${cost.estimatedUSD.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {transaction.errorMessage && (
              <div className="border-t pt-4">
                <label className="font-semibold text-red-600">Error:</label>
                <p className="text-red-600">{transaction.errorMessage}</p>
              </div>
            )}

            {receipt && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Receipt</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gas Used:</span>
                    <span>{receipt.gasUsed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confirmations:</span>
                    <span>{transaction.confirmations}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
