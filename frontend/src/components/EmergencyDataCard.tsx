import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Centralized stale-data policy for offline pet views.
 *
 * Thresholds are expressed in milliseconds and describe how long cached data
 * of a given type may be considered "current" before it is flagged as stale.
 * Keep this table as the single source of truth for every offline-capable view
 * so indicators stay consistent across the app.
 */
export const STALE_THRESHOLDS_MS = {
  /** Emergency / medical data must be verified frequently. */
  emergency: 15 * 60 * 1000, // 15 minutes
  /** General medical records tolerate a longer window. */
  medical: 60 * 60 * 1000, // 1 hour
  /** Non-critical profile data. */
  profile: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export type OfflineDataType = keyof typeof STALE_THRESHOLDS_MS;

/**
 * Lifecycle states an offline-capable view can be in.
 * - `no-cache`: nothing cached locally yet.
 * - `syncing`: a refresh is in flight.
 * - `current`: cached data is within its stale threshold.
 * - `stale`: cached data is older than its stale threshold.
 */
export type OfflineDataState = 'no-cache' | 'syncing' | 'current' | 'stale';

/**
 * Resolve the offline state for a cached payload.
 *
 * Clock skew is handled defensively: if the reported timestamp is in the
 * future relative to `now`, we clamp the age to 0 rather than producing a
 * negative age (which would otherwise read as "current" forever).
 */
export function resolveOfflineState(params: {
  lastSyncedAt: number | null;
  dataType: OfflineDataType;
  isSyncing?: boolean;
  now?: number;
}): { state: OfflineDataState; ageMs: number | null } {
  const { lastSyncedAt, dataType, isSyncing = false, now = Date.now() } = params;

  if (lastSyncedAt == null) {
    return { state: isSyncing ? 'syncing' : 'no-cache', ageMs: null };
  }

  const ageMs = Math.max(0, now - lastSyncedAt);

  if (isSyncing) {
    return { state: 'syncing', ageMs };
  }

  const threshold = STALE_THRESHOLDS_MS[dataType];
  return { state: ageMs > threshold ? 'stale' : 'current', ageMs };
}

/** Human-readable relative age, e.g. "just now", "4m ago", "2h ago". */
export function formatAge(ageMs: number | null): string {
  if (ageMs == null) return 'never synced';
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
  /**
   * Optional local revision counter. When it changes while a refresh is in
   * flight, the incoming refresh result must not clobber newer local edits.
   */
  localRevision?: number;
}

const STATE_LABELS: Record<OfflineDataState, string> = {
  'no-cache': 'Not cached',
  syncing: 'Syncing…',
  current: 'Current',
  stale: 'Stale',
};

export const EmergencyDataCard: React.FC<EmergencyDataCardProps> = ({
  data,
  onRefresh,
  localRevision = 0,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);
  const revisionAtStartRef = useRef<number>(localRevision);

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

  const { state, ageMs } = useMemo(
    () =>
      resolveOfflineState({
        lastSyncedAt: data?.lastSyncedAt ?? null,
        dataType: 'emergency',
        isSyncing,
        now,
      }),
    [data?.lastSyncedAt, isSyncing, now],
  );

  const handleRefresh = useCallback(async () => {
    if (isSyncing) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    revisionAtStartRef.current = localRevision;
    setIsSyncing(true);
    setRefreshError(null);

    try {
      await onRefresh(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setRefreshError('Refresh failed. Showing cached data.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, localRevision, onRefresh]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSyncing(false);
  }, []);

  const isStale = state === 'stale';
  const isNoCache = state === 'no-cache';

  return (
    <section
      className={`emergency-data-card emergency-data-card--${state}`}
      aria-live="polite"
      aria-busy={isSyncing}
    >
      <header className="emergency-data-card__header">
        <h2 className="emergency-data-card__title">Emergency Information</h2>
        <span
          className={`emergency-data-card__badge emergency-data-card__badge--${state}`}
          data-state={state}
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
          <p className="emergency-data-card__summary">{data?.summary}</p>

          <dl className="emergency-data-card__meta">
            <div>
              <dt>Last synced</dt>
              <dd>{formatAge(ageMs)}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>
                {data?.verified ? 'Verified' : 'Unverified'}
              </dd>
            </div>
          </dl>

          {isStale && (
            <p className="emergency-data-card__warning" role="alert">
              This emergency data is out of date. Refresh before relying on it.
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
          <button type="button" onClick={handleCancel}>
            Cancel refresh
          </button>
        ) : (
          <button type="button" onClick={handleRefresh}>
            {isNoCache ? 'Sync now' : 'Refresh'}
          </button>
        )}
      </div>
    </section>
  );
};

export default EmergencyDataCard;
