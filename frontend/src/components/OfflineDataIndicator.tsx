import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Centralized stale-data policy for offline-capable pet views.
 *
 * Thresholds are expressed in milliseconds and documented here so every
 * offline view shares the same freshness semantics. A record is considered
 * "stale" once its age exceeds the threshold for its data type.
 */
export const STALE_THRESHOLDS_MS = {
  /** General pet profile data: 24 hours. */
  profile: 24 * 60 * 60 * 1000,
  /** Medical records: 12 hours. */
  medical: 12 * 60 * 60 * 1000,
  /** Emergency / critical data: 1 hour. */
  emergency: 60 * 60 * 1000,
} as const;

export type OfflineDataType = keyof typeof STALE_THRESHOLDS_MS;

/**
 * Freshness states surfaced to the user.
 * - `no-cache`: nothing cached yet, nothing to show.
 * - `syncing`: a refresh is in flight.
 * - `current`: cached data is within its stale threshold.
 * - `stale`: cached data is older than its stale threshold.
 */
export type FreshnessState = 'no-cache' | 'syncing' | 'current' | 'stale';

export interface OfflineDataIndicatorProps {
  /** Which data type this view renders; selects the stale threshold. */
  dataType: OfflineDataType;
  /** Epoch ms of the last successful sync, or null when nothing is cached. */
  lastSyncedAt: number | null;
  /** Epoch ms of the last verification, or null when unverified. */
  lastVerifiedAt?: number | null;
  /** Whether the device is currently offline. */
  isOffline?: boolean;
  /**
   * Performs a refresh. Must resolve when the refresh settles. Receives an
   * AbortSignal so callers can cancel in-flight work.
   */
  onRefresh?: (signal: AbortSignal) => Promise<void>;
  /**
   * Returns true when a newer local edit exists that a refresh must not
   * overwrite. When true, refresh is blocked and the user is warned.
   */
  hasNewerLocalEdits?: () => boolean;
  /** Injectable clock for tests (clock skew coverage). Defaults to Date.now. */
  now?: () => number;
}

function formatAge(ageMs: number): string {
  if (ageMs < 0) {
    // Clock skew: cached timestamp is in the future relative to local clock.
    return 'just now';
  }
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'unknown';
  }
}

/**
 * Renders cached/syncing/current/stale state for an offline-capable view.
 * Emergency data additionally shows age and verification status without
 * exposing any private record contents.
 */
export const OfflineDataIndicator: React.FC<OfflineDataIndicatorProps> = ({
  dataType,
  lastSyncedAt,
  lastVerifiedAt = null,
  isOffline = false,
  onRefresh,
  hasNewerLocalEdits,
  now = Date.now,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [blockedByLocalEdits, setBlockedByLocalEdits] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight refresh when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const threshold = STALE_THRESHOLDS_MS[dataType];

  const ageMs = useMemo(() => {
    if (lastSyncedAt == null) return null;
    return now() - lastSyncedAt;
  }, [lastSyncedAt, now]);

  const state: FreshnessState = useMemo(() => {
    if (isSyncing) return 'syncing';
    if (lastSyncedAt == null) return 'no-cache';
    // Negative age (clock skew) is treated as fresh, never stale.
    if (ageMs != null && ageMs > threshold) return 'stale';
    return 'current';
  }, [isSyncing, lastSyncedAt, ageMs, threshold]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isSyncing) return;

    // Never overwrite newer local edits with a refresh.
    if (hasNewerLocalEdits?.()) {
      setBlockedByLocalEdits(true);
      return;
    }

    setBlockedByLocalEdits(false);
    setRefreshError(null);
    setIsSyncing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await onRefresh(controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setRefreshError('Refresh failed. Showing cached data.');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsSyncing(false);
    }
  }, [onRefresh, isSyncing, hasNewerLocalEdits]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSyncing(false);
  }, []);

  const label = useMemo(() => {
    switch (state) {
      case 'no-cache':
        return 'No cached data';
      case 'syncing':
        return 'Syncing…';
      case 'stale':
        return 'Stale data';
      case 'current':
      default:
        return 'Up to date';
    }
  }, [state]);

  const isEmergency = dataType === 'emergency';

  return (
    <div
      className={`offline-data-indicator offline-data-indicator--${state}`}
      role="status"
      aria-live="polite"
      data-state={state}
      data-data-type={dataType}
    >
      <span className="offline-data-indicator__label">{label}</span>

      {lastSyncedAt != null && (
        <span className="offline-data-indicator__synced">
          Last synced {formatAge(ageMs ?? 0)} ({formatTimestamp(lastSyncedAt)})
        </span>
      )}

      {isEmergency && (
        <span className="offline-data-indicator__verification">
          {lastVerifiedAt != null
            ? `Verified ${formatAge(now() - lastVerifiedAt)}`
            : 'Unverified'}
        </span>
      )}

      {isOffline && (
        <span className="offline-data-indicator__offline">Offline</span>
      )}

      {refreshError && (
        <span className="offline-data-indicator__error" role="alert">
          {refreshError}
        </span>
      )}

      {blockedByLocalEdits && (
        <span className="offline-data-indicator__blocked" role="alert">
          You have unsaved changes. Refresh skipped to avoid overwriting them.
        </span>
      )}

      {onRefresh && (
        <span className="offline-data-indicator__actions">
          {isSyncing ? (
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
          ) : (
            <button type="button" onClick={handleRefresh}>
              Refresh
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default OfflineDataIndicator;
