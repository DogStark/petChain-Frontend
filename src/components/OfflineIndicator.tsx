import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';
import type { SyncStatus } from '@/lib/offline/syncManager';

function getStatusConfig(status: SyncStatus) {
  switch (status) {
    case 'syncing':
      return { bg: 'bg-blue-100', text: 'text-blue-700', icon: RefreshCw, label: 'Syncing...' };
    case 'success':
      return { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Synced' };
    case 'conflict':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle, label: 'Sync conflicts' };
    case 'error':
      return { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: 'Sync error' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', icon: Wifi, label: 'Connected' };
  }
}

interface OfflineIndicatorProps {
  showLabel?: boolean;
  className?: string;
}

export default function OfflineIndicator({ showLabel = true, className = '' }: OfflineIndicatorProps) {
  const { isOnline, syncStatus, pendingSyncCount, syncDetails, triggerSync } = useOffline();
  const statusConfig = getStatusConfig(syncStatus);

  if (isOnline && syncStatus === 'idle' && pendingSyncCount === 0) {
    // Online and idle - show minimal indicator or nothing
    return (
      <div className={`flex items-center gap-1.5 text-xs ${className}`} title="Online">
        <Wifi className="w-3.5 h-3.5 text-green-500" />
        {showLabel && <span className="text-gray-500">Online</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {!isOnline ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
          <WifiOff className="w-3.5 h-3.5" />
          {showLabel && <span className="font-medium">Offline</span>}
          {pendingSyncCount > 0 && (
            <span className="bg-red-200 text-red-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {pendingSyncCount}
            </span>
          )}
        </div>
      ) : syncStatus !== 'idle' ? (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text} border`}>
          <statusConfig.icon className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          {showLabel && (
            <span className="font-medium">
              {statusConfig.label}
              {syncDetails ? `: ${syncDetails}` : ''}
            </span>
          )}
          {syncStatus === 'error' || syncStatus === 'conflict' ? (
            <button
              onClick={(e) => { e.stopPropagation(); triggerSync(); }}
              className="ml-1 p-0.5 rounded hover:bg-black/10 transition-colors"
              title="Retry sync"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      ) : pendingSyncCount > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5" />
          {showLabel && <span className="font-medium">{pendingSyncCount} pending</span>}
          <button
            onClick={(e) => { e.stopPropagation(); triggerSync(); }}
            className="ml-1 p-0.5 rounded hover:bg-blue-100 transition-colors"
            title="Sync now"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
