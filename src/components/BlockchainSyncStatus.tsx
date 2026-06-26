import React from 'react';
import { useBlockchainSync } from '@/hooks/useBlockchainSync';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

export const BlockchainSyncStatus: React.FC = () => {
  const { syncStatuses } = useBlockchainSync();

  // Derived counts
  const syncedCount   = syncStatuses.filter((s) => s.status === 'success').length;
  const syncingCount  = syncStatuses.filter((s) => s.status === 'syncing' || s.status === 'retrying').length;
  const failedCount   = syncStatuses.filter((s) => s.status === 'failed').length;
  const pendingCount  = syncStatuses.filter((s) => s.status !== 'success' && s.status !== 'failed' && s.status !== 'syncing' && s.status !== 'retrying').length;

  // True when at least one item is actively syncing or retrying
  const isAnySyncing = syncingCount > 0;

  // Build the summary string from non-zero counts only
  const summaryParts: string[] = [];
  if (syncedCount  > 0) summaryParts.push(`${syncedCount} synced`);
  if (syncingCount > 0) summaryParts.push(`${syncingCount} syncing`);
  if (failedCount  > 0) summaryParts.push(`${failedCount} failed`);
  if (pendingCount > 0) summaryParts.push(`${pendingCount} pending`);
  const summaryLine = summaryParts.join(' · ');

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

  const getRowClassName = (status: string) => {
    const base = 'flex items-center justify-between p-3 border rounded';
    if (status === 'syncing' || status === 'retrying') {
      return `${base} border-l-4 border-l-blue-400 bg-blue-50`;
    }
    return base;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-1">Blockchain Sync Status</h2>

      {/* Status summary line */}
      {syncStatuses.length > 0 && (
        <p className="text-sm text-gray-500 mb-3">{summaryLine}</p>
      )}

      {/* Top-level syncing banner */}
      {isAnySyncing && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-md bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Sync in progress...</span>
        </div>
      )}

      <div className="space-y-3">
        {syncStatuses.map((sync) => (
          <div key={sync.recordId} className={getRowClassName(sync.status)}>
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
