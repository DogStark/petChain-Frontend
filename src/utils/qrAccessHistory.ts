/**
 * Privacy-preserving access history for a public QR profile.
 *
 * The backend owns authorization and consent: it decides *whether* an owner is
 * allowed to see this log, and *what* coarse fields it shares (a region, if any).
 * This module only ever exposes a coarse, identity-free view:
 *   - a timestamp bucket floored to the hour (no precise time), and
 *   - the region, only when the backend recorded one.
 * Scanner identity (id/name) and precise location (lat/lng/city/ip) are never
 * read into the safe view, so they cannot leak into the UI by accident.
 *
 * Pure and side-effect free — safe to unit test without a DOM or network.
 */

export interface RawAccessEntry {
  /** When the QR profile was accessed (ISO 8601 string or epoch milliseconds). */
  timestamp?: string | number | null;
  /** Coarse region where the scan originated, if the backend chose to share it. */
  region?: string | null;
  // The following are intentionally part of the raw record but MUST be stripped.
  // They are listed only to document what this module refuses to surface.
  scannerId?: string | null;
  scannerName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  ip?: string | null;
  preciseLocation?: unknown;
}

export interface SafeAccessEntry {
  /** Coarse time bucket (hour resolution), floored to UTC. */
  bucket: string | null;
  /** Human-readable bucket label, e.g. "2026-10-25 12:00 UTC". */
  bucketLabel: string;
  /** Region where the scan originated, or null when not recorded. */
  region: string | null;
  /** Whether the backend recorded a region for this entry. */
  regionAvailable: boolean;
}

export interface QrAccessHistory {
  /** Whether any scans are available to show. */
  hasEntries: boolean;
  /** True when the owner has not enabled access history or the backend denied it. */
  denied: boolean;
  /** Number of scans shown (a coarse count, never tied to distinct identities). */
  count: number;
  /** Coarse, identity-free entries (scanner identity + precise location stripped). */
  entries: SafeAccessEntry[];
  /** Colour-independent summary for screen readers / status text. */
  summary: string;
  /** Optional non-fatal note, e.g. region not recorded for some scans. */
  note?: string;
}

const UNKNOWN_BUCKET = 'Unknown time';

function formatBucketLabel(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00 UTC`;
}

function toSafeEntry(raw: RawAccessEntry | null | undefined): SafeAccessEntry {
  const ts = raw ? raw.timestamp : undefined;
  let bucket: string | null = null;
  let bucketLabel = UNKNOWN_BUCKET;
  if (ts !== null && ts !== undefined && ts !== '') {
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    if (!Number.isNaN(date.getTime())) {
      const floored = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours(),
          0,
          0,
          0,
        ),
      );
      bucket = floored.toISOString();
      bucketLabel = formatBucketLabel(floored);
    }
  }
  const regionRaw = raw ? raw.region : undefined;
  const region =
    typeof regionRaw === 'string' && regionRaw.trim().length > 0 ? regionRaw.trim() : null;
  return {
    bucket,
    bucketLabel,
    region,
    regionAvailable: region !== null,
  };
}

export interface BuildQrAccessHistoryOptions {
  /** When true, the owner has not enabled history or the backend denied access. */
  denied?: boolean;
}

/**
 * Build a coarse, privacy-preserving access history from raw scan records.
 * Never throws; malformed input degrades to "unknown time" / "region not recorded".
 */
export function buildQrAccessHistory(
  entries: RawAccessEntry[] | null | undefined,
  options: BuildQrAccessHistoryOptions = {},
): QrAccessHistory {
  const denied = options.denied === true;
  const list = Array.isArray(entries) ? entries : [];

  if (denied) {
    return {
      hasEntries: false,
      denied: true,
      count: 0,
      entries: [],
      summary: 'Access history is turned off for your public profile, so no scans are shown.',
    };
  }

  const safeEntries = list.map(toSafeEntry);
  const count = safeEntries.length;
  const hasEntries = count > 0;

  let summary: string;
  if (!hasEntries) {
    summary = 'No one has scanned your public profile yet.';
  } else {
    summary = `${count} scan${count === 1 ? '' : 's'} of your public profile are shown at coarse, privacy-preserving detail.`;
  }

  const someRegionMissing = hasEntries && safeEntries.some((e) => !e.regionAvailable);
  const note = someRegionMissing
    ? 'Region was not recorded for some scans, so those rows show no location.'
    : undefined;

  return {
    hasEntries,
    denied: false,
    count,
    entries: safeEntries,
    summary,
    note,
  };
}
