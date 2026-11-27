'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SyncState = 'synced' | 'syncing' | 'error';

export interface BlockchainSyncStatusProps {
  /** Optional controlled sync state. When omitted, the component manages its own state. */
  state?: SyncState;
  /** Optional controlled last sync timestamp. */
  lastSyncAt?: Date | null;
  /** Called when the user requests a manual sync. Return a promise to keep the syncing state until it resolves. */
  onSync?: () => void | Promise<void>;
}

const STATE_CONFIG: Record<
  SyncState,
  { label: string; dotClass: string; ariaLabel: string }
> = {
  synced: {
    label: 'Synced',
    dotClass: 'bg-green-400',
    ariaLabel: 'Blockchain data is in sync',
  },
  syncing: {
    label: 'Syncing',
    dotClass: 'bg-yellow-300 animate-pulse',
    ariaLabel: 'Blockchain data is syncing',
  },
  error: {
    label: 'Sync error',
    dotClass: 'bg-red-400',
    ariaLabel: 'Blockchain sync error',
  },
};

function formatLastSync(lastSyncAt: Date | null): string {
  if (!lastSyncAt) {
    return 'Never synced';
  }
  return `Last synced: ${lastSyncAt.toLocaleString()}`;
}

export default function BlockchainSyncStatus({
  state: controlledState,
  lastSyncAt: controlledLastSyncAt,
  onSync,
}: BlockchainSyncStatusProps) {
  const [internalState, setInternalState] = useState<SyncState>('synced');
  const [internalLastSyncAt, setInternalLastSyncAt] = useState<Date | null>(
    new Date()
  );
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const state = controlledState ?? internalState;
  const lastSyncAt =
    controlledLastSyncAt !== undefined ? controlledLastSyncAt : internalLastSyncAt;

  const handleManualSync = useCallback(async () => {
    if (state === 'syncing') {
      return;
    }

    if (controlledState === undefined) {
      setInternalState('syncing');
    }

    try {
      await onSync?.();
      if (isMounted.current && controlledState === undefined) {
        setInternalState('synced');
        setInternalLastSyncAt(new Date());
      }
    } catch {
      if (isMounted.current && controlledState === undefined) {
        setInternalState('error');
      }
    }
  }, [controlledState, onSync, state]);

  const config = STATE_CONFIG[state];
  const tooltip = `${config.ariaLabel}. ${formatLastSync(lastSyncAt)}. Click to sync now.`;

  return (
    <button
      type="button"
      onClick={handleManualSync}
      disabled={state === 'syncing'}
      title={tooltip}
      aria-label={tooltip}
      aria-live="polite"
      className="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`}
      />
      <span className="hidden sm:inline">{config.label}</span>
    </button>
  );
}
