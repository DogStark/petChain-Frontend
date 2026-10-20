import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAge, resolveOfflineState } from '../offline/staleThresholds';

export interface EmergencyDataCardProps {
  /** Cached emergency payload, or null when nothing is cached. */
  data: {
    petName: string;
    /** Non-sensitive summary only; never render raw private fields here. */
    summary: string;
    /** Whether the cached payload was verified by the backend. */
    verified: boolean;
    /** Epoch ms of the last successful sync. */
    lastSyncedAt: number | null;
  } | null;
  /**
   * Trigger a refresh. Must return a promise that resolves when the refresh
   * settles. The card treats it as cancellable via the returned signal.
   */
  onRefresh: (signal: AbortSignal) => Promise<void>;
}

type EmergencyCardState = 'no-cache' | 'syncing' | 'current' | 'stale';

const STATE_LABELS: Record<EmergencyCardState, string> = {
  'no-cache': 'Not cached',
  syncing: 'Syncing…',
  current: 'Current',
  stale: 'Stale',
};

export const EmergencyDataCard: React.FC<EmergencyDataCardProps> = ({
  data,
  onRefresh,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);

  // Keep the displayed age fresh without re-fetching.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Abort any in-flight refresh on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cachedState: Exclude<EmergencyCardState, 'syncing'> = useMemo(() => {
    const resolved = resolveOfflineState('emergency', data?.lastSyncedAt ?? null, now);
    if (resolved === 'stale') return 'stale';
    if (resolved === 'no-cache') return data == null ? 'no-cache' : 'stale';
    return 'current';
  }, [data, data?.lastSyncedAt, now]);
  const state: EmergencyCardState = isSyncing ? 'syncing' : cachedState;

  const handleRefresh = useCallback(async () => {
    if (abortRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsSyncing(true);
    setRefreshError(null);

    try {
      await onRefresh(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setRefreshError('Refresh failed. Showing cached data.');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsSyncing(false);
      }
    }
  }, [onRefresh]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSyncing(false);
    setRefreshError('Refresh cancelled. Showing cached data.');
  }, []);

  const isStale = cachedState === 'stale';
  const isNoCache = data == null;

  return (
    <section
      className={`emergency-data-card emergency-data-card--${state}`}
      aria-busy={isSyncing}
      aria-labelledby="emergency-data-card-title"
    >
      <header className="emergency-data-card__header">
        <h2 id="emergency-data-card-title" className="emergency-data-card__title">
          Emergency Information
        </h2>
        <span
          className={`emergency-data-card__badge emergency-data-card__badge--${state}`}
          data-state={state}
          role="status"
          aria-live="polite"
        >
          {STATE_LABELS[state]}
        </span>
      </header>

      {isNoCache ? (
        <p className="emergency-data-card__empty">
          No emergency data is cached on this device. Connect to sync.
        </p>
      ) : (
        <>
          <p className="emergency-data-card__summary">{data.summary}</p>

          <dl className="emergency-data-card__meta">
            <div>
              <dt>Last synced</dt>
              <dd>{formatAge(data.lastSyncedAt, now) ?? 'never synced'}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{data.verified ? 'Verified' : 'Unverified'}</dd>
            </div>
          </dl>

          {isStale && (
            <p className="emergency-data-card__warning" role="alert">
              This saved emergency information may be out of date. Your saved
              profile remains available; refresh to check for updates.
            </p>
          )}
        </>
      )}

      {refreshError && (
        <p className="emergency-data-card__error" role="alert">
          {refreshError}
        </p>
      )}

      <div className="emergency-data-card__actions">
        {isSyncing ? (
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel emergency information refresh"
          >
            Cancel refresh
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh emergency information online"
          >
            {isNoCache ? 'Sync now' : 'Refresh'}
          </button>
        )}
      </div>
    </section>
  );
};

export default EmergencyDataCard;
