/**
 * Centralized stale-data thresholds and refresh policy for offline pet views.
 *
 * Issue #947: Offline mode can show cached medical and emergency data without
 * making its age or verification state obvious. This module is the single
 * source of truth for how old cached data may be before it is considered
 * stale, and for the states an offline-capable view can be in.
 *
 * Thresholds are expressed in milliseconds and are intentionally conservative
 * for safety-critical data (emergency, medical) and more relaxed for
 * non-critical data (profile, preferences).
 */

/**
 * The lifecycle state of an offline-capable view.
 *
 * - `no-cache`: nothing has ever been cached for this view.
 * - `syncing`: a refresh is in flight; cached data (if any) is still shown.
 * - `current`: cached data exists and is within its fresh threshold.
 * - `stale`: cached data exists but is older than its stale threshold.
 */
export type OfflineDataState = 'no-cache' | 'syncing' | 'current' | 'stale';

/**
 * Verification status for cached data. Emergency data must surface this
 * without exposing any additional private fields.
 */
export type VerificationStatus = 'verified' | 'unverified' | 'unknown';

/**
 * Data categories that participate in the offline stale-data policy.
 * Keep this list small and explicit so thresholds stay auditable.
 */
export type OfflineDataType =
  | 'emergency'
  | 'medical'
  | 'profile'
  | 'preferences';

/**
 * Stale thresholds per data type, in milliseconds.
 *
 * `freshMs`  - data younger than this is `current`.
 * `staleMs`  - data older than this is `stale`; between the two it is still
 *              usable but should be flagged as aging.
 *
 * Emergency and medical data use short windows because acting on outdated
 * information can be harmful. Profile/preferences are informational only.
 */
export const STALE_THRESHOLDS: Record<
  OfflineDataType,
  { freshMs: number; staleMs: number }
> = {
  emergency: { freshMs: 5 * 60 * 1000, staleMs: 30 * 60 * 1000 },
  medical: { freshMs: 15 * 60 * 1000, staleMs: 60 * 60 * 1000 },
  profile: { freshMs: 24 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 },
  preferences: { freshMs: 24 * 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000 },
};

/**
 * Maximum tolerated clock skew between the device and the server, in ms.
 * Timestamps that appear to come from the future within this window are
 * treated as "now" rather than as invalid, so a slightly fast device clock
 * does not make fresh data look stale.
 */
export const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Resolve the offline state for a cached entry.
 *
 * @param dataType   category used to look up thresholds
 * @param cachedAt   epoch ms when the entry was cached, or null if never cached
 * @param now        epoch ms "now" (injectable for tests / clock skew)
 * @param isSyncing  whether a refresh is currently in flight
 */
export function resolveOfflineState(
  dataType: OfflineDataType,
  cachedAt: number | null,
  now: number = Date.now(),
  isSyncing: boolean = false,
): OfflineDataState {
  if (cachedAt == null) {
    return 'no-cache';
  }

  // Clamp future timestamps caused by clock skew so they read as fresh.
  const effectiveNow = Math.max(now, cachedAt - MAX_CLOCK_SKEW_MS);
  const age = effectiveNow - cachedAt;
  const { staleMs } = STALE_THRESHOLDS[dataType];

  if (age > staleMs) {
    return 'stale';
  }
  if (isSyncing) {
    return 'syncing';
  }
  return 'current';
}

/**
 * Human-readable age label for a cached entry, e.g. "3m ago".
 * Returns null when there is no cache to describe.
 */
export function formatAge(
  cachedAt: number | null,
  now: number = Date.now(),
): string | null {
  if (cachedAt == null) {
    return null;
  }
  const effectiveNow = Math.max(now, cachedAt - MAX_CLOCK_SKEW_MS);
  const ageMs = Math.max(0, effectiveNow - cachedAt);
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Whether a refresh may proceed without clobbering newer local edits.
 *
 * A refresh must be skipped when the local entry has been edited more
 * recently than the cached snapshot it would replace.
 */
export function canRefreshOverwrite(
  cachedAt: number | null,
  lastLocalEditAt: number | null,
): boolean {
  if (cachedAt == null) {
    return true;
  }
  if (lastLocalEditAt == null) {
    return true;
  }
  return lastLocalEditAt <= cachedAt;
}
