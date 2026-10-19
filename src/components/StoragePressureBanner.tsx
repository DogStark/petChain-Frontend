import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, HardDrive, X } from 'lucide-react';
import {
  subscribeToStorageEvents,
  estimateStorageUsage,
  notifyQuotaOk,
} from '@/lib/offline/storageManager';
import type { StorageUsageEstimate } from '@/lib/offline/storageManager';
import { evictCacheEntries, evictRecordEntries, clearExpiredCache } from '@/lib/offline/indexedDB';

interface BannerState {
  message: string;
  usage?: StorageUsageEstimate;
}

const WARN_THRESHOLD_PERCENT = 80;

/**
 * Surfaces actionable feedback when the browser's storage quota is nearly
 * exhausted or when offline writes are being evicted. Queued mutations are
 * never lost by the eviction logic; this banner only clears non-essential
 * cached data.
 */
export default function StoragePressureBanner() {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const applyUsage = useCallback((usage: StorageUsageEstimate | null) => {
    if (usage && usage.percentUsed >= WARN_THRESHOLD_PERCENT) {
      setBanner({
        usage,
        message: `Browser storage is ${usage.percentUsed.toFixed(0)}% full. Offline cached data may be evicted.`,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeToStorageEvents((event) => {
      if (!mounted) return;
      if (event.type === 'quota-exceeded') {
        setBanner({ message: event.message });
      } else if (event.type === 'evicted') {
        setBanner({
          message: `Freed storage by clearing ${event.removed} cached item(s). Your offline changes are safe.`,
        });
      } else if (event.type === 'quota-ok') {
        setBanner(null);
      }
    });

    estimateStorageUsage().then((usage) => {
      if (mounted) applyUsage(usage);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyUsage]);

  const handleFreeSpace = useCallback(async () => {
    setIsClearing(true);
    try {
      await clearExpiredCache();
      let removed = await evictCacheEntries(50);
      if (removed === 0) {
        // Cache is empty; fall back to old offline record snapshots. The sync
        // queue is never touched.
        removed = await evictRecordEntries(20);
      }
      const usage = await estimateStorageUsage();
      setBanner({
        usage: usage ?? undefined,
        message:
          removed > 0
            ? `Freed up storage by clearing ${removed} cached item(s).`
            : 'No unnecessary cached data found. Your queued offline changes are kept.',
      });
      notifyQuotaOk();
    } finally {
      setIsClearing(false);
    }
  }, []);

  if (!banner) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-amber-50 border-b border-amber-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-amber-800 flex-1 min-w-[16rem]">{banner.message}</p>
        <button
          type="button"
          onClick={handleFreeSpace}
          disabled={isClearing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <HardDrive size={13} aria-hidden="true" />
          {isClearing ? 'Clearing…' : 'Free up space'}
        </button>
        <button
          type="button"
          onClick={() => setBanner(null)}
          aria-label="Dismiss storage warning"
          className="p-1 rounded text-amber-600 hover:bg-amber-100 transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
