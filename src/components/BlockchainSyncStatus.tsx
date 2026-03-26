import React from 'react';
import { useBlockchainSync } from '@/hooks/useBlockchainSync';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

export const BlockchainSyncStatus: React.FC = () => {
  const { syncStatuses } = useBlockchainSync();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'syncing':
      case 'retrying':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Blockchain Sync Status</h2>
      <div className="space-y-3">
        {syncStatuses.map((sync) => (
          <div key={sync.recordId} className="flex items-center justify-between p-3 border rounded">
            <div className="flex items-center gap-3">
              {getStatusIcon(sync.status)}
              <div>
                <p className="font-medium">Record {sync.recordId}</p>
                {sync.txHash && (
                  <p className="text-sm text-gray-500">TX: {sync.txHash.substring(0, 16)}...</p>
                )}
                {sync.ipfsHash && (
                  <p className="text-sm text-gray-500">IPFS: {sync.ipfsHash.substring(0, 16)}...</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium capitalize">{sync.status}</p>
              <p className="text-xs text-gray-500">Fee: {sync.fee} stroops</p>
              {sync.attempts > 0 && (
                <p className="text-xs text-orange-500">Attempts: {sync.attempts}</p>
              )}
            </div>
          </div>
        ))}
        {syncStatuses.length === 0 && (
          <p className="text-gray-500 text-center py-4">No sync operations yet</p>
        )}
      </div>
    </div>
  );
};
