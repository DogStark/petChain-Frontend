import { useEffect, useState } from 'react';
import type {
  Transaction,
  TransactionReceipt,
  TransactionCost,
} from '@/lib/api/transactionAPI';
import { formatDateTime } from '@/utils/formatDate';
import { useTransactions } from '@/hooks/useTransactions';
import { isTestnetNetwork } from '@/lib/blockchain/network';
import {
  downloadTransactionReceiptPdf,
  isReceiptEligibleTransaction,
} from '@/lib/wallet/transactionReceiptPdf';

interface TransactionDetailsProps {
  transactionId: string;
  onClose: () => void;
}

export default function TransactionDetails({ transactionId, onClose }: TransactionDetailsProps) {
  const { getTransaction, getTransactionReceipt, getTransactionCost } = useTransactions();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [cost, setCost] = useState<TransactionCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptDownloadError, setReceiptDownloadError] = useState<string | null>(null);

  useEffect(() => {
    loadTransactionDetails();
  }, [transactionId]);

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);
      const [txData, receiptData, costData] = await Promise.all([
        getTransaction(transactionId),
        getTransactionReceipt(transactionId).catch(() => null),
        getTransactionCost(transactionId).catch(() => null),
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

  const handleReceiptDownload = () => {
    if (!transaction) return;
    try {
      downloadTransactionReceiptPdf(
        { ...transaction, blockNumber: transaction.blockNumber ?? receipt?.blockNumber },
        isTestnetNetwork() ? 'TESTNET' : 'PUBLIC',
      );
      setReceiptDownloadError(null);
    } catch (error) {
      setReceiptDownloadError(
        error instanceof Error ? error.message : 'Unable to download transaction receipt',
      );
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!transaction) return <div className="p-4">Transaction not found</div>;
  const receiptTransaction = {
    ...transaction,
    blockNumber: transaction.blockNumber ?? receipt?.blockNumber,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Transaction Details</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {isReceiptEligibleTransaction(receiptTransaction) && (
              <button
                type="button"
                onClick={handleReceiptDownload}
                aria-label={`Download PDF receipt for transaction ${transaction.id}`}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Download receipt PDF
              </button>
            )}
            {receiptDownloadError && (
              <p role="alert" className="text-sm text-red-700">{receiptDownloadError}</p>
            )}
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
              <p>{formatDateTime(transaction.timestamp)}</p>
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
