/**
 * Bounded, opt-in draft store for long clinical forms.
 *
 * Guarantees:
 * - Drafts are never restored without explicit user choice (callers must
 *   surface a restore prompt and call `restore` only after consent).
 * - Drafts are minimized according to policy: only allow-listed fields are
 *   persisted, and values are length-capped.
 * - Expired drafts and drafts bound to a different account are purged.
 * - The store is bounded by both a per-draft size cap and a total count cap.
 * - Every draft carries a schema version so stale shapes are discarded.
 */

export const DRAFT_VERSION = 1;

/** Maximum serialized size (in characters) allowed for a single draft. */
export const MAX_DRAFT_BYTES = 64 * 1024;

/** Maximum number of drafts retained across all forms. */
export const MAX_DRAFTS = 20;

/** Default time-to-live for a draft, in milliseconds (24 hours). */
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum length persisted for any single field value. */
export const MAX_FIELD_LENGTH = 4096;

const STORAGE_KEY = "handsoff.formDrafts.v1";

/**
 * Policy: only these fields are ever persisted. Anything not listed here is
 * dropped before the draft is written, keeping stored data minimized.
 */
export const DRAFT_ALLOWED_FIELDS: readonly string[] = [
  "patientId",
  "encounterId",
  "chiefComplaint",
  "historyOfPresentIllness",
  "assessment",
  "plan",
  "notes",
];

export interface DraftRecord<T = Record<string, unknown>> {
  /** Schema version of the stored payload. */
  version: number;
  /** Account the draft belongs to; mismatches are purged. */
  accountId: string;
  /** Form identifier the draft was captured for. */
  formId: string;
  /** Epoch ms when the draft was written. */
  savedAt: number;
  /** Epoch ms after which the draft is considered expired. */
  expiresAt: number;
  /** Minimized, allow-listed form values. */
  values: T;
}

export interface SaveDraftOptions {
  accountId: string;
  formId: string;
  values: Record<string, unknown>;
  /** Override the default TTL. */
  ttlMs?: number;
  /** Injectable clock for tests. */
  now?: number;
}

export interface RestoreDraftOptions {
  accountId: string;
  formId: string;
  /** Injectable clock for tests. */
  now?: number;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): Record<string, DraftRecord> {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, DraftRecord>;
  } catch {
    return {};
  }
}

function writeAll(drafts: Record<string, DraftRecord>): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Storage may be full or unavailable; drafts are best-effort.
  }
}

function draftKey(accountId: string, formId: string): string {
  return `${accountId}::${formId}`;
}

/**
 * Minimize values to the allow-list and cap each field's length.
 */
export function minimizeValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const minimized: Record<string, unknown> = {};
  for (const field of DRAFT_ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, field)) continue;
    const value = values[field];
    if (typeof value === "string") {
      minimized[field] = value.slice(0, MAX_FIELD_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      minimized[field] = value;
    }
    // Objects/arrays are intentionally dropped to keep stored data minimal.
  }
  return minimized;
}

/**
 * Remove drafts that are expired, version-mismatched, or bound to a
 * different account. Returns the surviving drafts.
 */
export function purgeDrafts(
  drafts: Record<string, DraftRecord>,
  accountId: string,
  now: number,
): Record<string, DraftRecord> {
  const survivors: Record<string, DraftRecord> = {};
  for (const [key, draft] of Object.entries(drafts)) {
    if (!draft || typeof draft !== "object") continue;
    if (draft.version !== DRAFT_VERSION) continue;
    if (draft.accountId !== accountId) continue;
    if (typeof draft.expiresAt !== "number" || draft.expiresAt <= now) continue;
    survivors[key] = draft;
  }
  return survivors;
}

/**
 * Enforce the total draft count bound, evicting the oldest drafts first.
 */
function enforceCountBound(
  drafts: Record<string, DraftRecord>,
): Record<string, DraftRecord> {
  const entries = Object.entries(drafts);
  if (entries.length <= MAX_DRAFTS) return drafts;
  entries.sort((a, b) => a[1].savedAt - b[1].savedAt);
  const kept = entries.slice(entries.length - MAX_DRAFTS);
  return Object.fromEntries(kept);
}

/**
 * Persist a minimized draft. Returns true when the draft was stored.
 * Oversized drafts are rejected rather than silently truncated.
 */
export function saveDraft(options: SaveDraftOptions): boolean {
  const { accountId, formId, values } = options;
  if (!accountId || !formId) return false;

  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;

  const record: DraftRecord = {
    version: DRAFT_VERSION,
    accountId,
    formId,
    savedAt: now,
    expiresAt: now + ttl,
    values: minimizeValues(values),
  };

  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_DRAFT_BYTES) return false;

  const drafts = purgeDrafts(readAll(), accountId, now);
  drafts[draftKey(accountId, formId)] = record;
  writeAll(enforceCountBound(drafts));
  return true;
}

/**
 * Read a draft for the given account/form without restoring it. Expired or
 * account-mismatched drafts are purged as a side effect. Returns null when no
 * valid draft exists. Callers MUST prompt the user before applying the values.
 */
export function peekDraft<T = Record<string, unknown>>(
  options: RestoreDraftOptions,
): DraftRecord<T> | null {
  const { accountId, formId } = options;
  const now = options.now ?? Date.now();

  const drafts = purgeDrafts(readAll(), accountId, now);
  writeAll(drafts);

  const draft = drafts[draftKey(accountId, formId)];
  return draft ? (draft as DraftRecord<T>) : null;
}

/**
 * Restore a draft's values. This is the explicit user-choice entry point:
 * callers should only invoke it after the user accepts the restore prompt.
 * Returns null when no valid draft exists.
 */
export function restoreDraft<T = Record<string, unknown>>(
  options: RestoreDraftOptions,
): T | null {
  const draft = peekDraft<T>(options);
  return draft ? draft.values : null;
}

/**
 * Discard a single draft (e.g. after the user declines to restore).
 */
export function discardDraft(options: RestoreDraftOptions): void {
  const { accountId, formId } = options;
  const now = options.now ?? Date.now();
  const drafts = purgeDrafts(readAll(), accountId, now);
  delete drafts[draftKey(accountId, formId)];
  writeAll(drafts);
}

/**
 * Purge all drafts for an account. Intended for sign-out / account switch so
 * drafts never leak across accounts.
 */
export function clearAccountDrafts(accountId: string, now = Date.now()): void {
  const drafts = readAll();
  const survivors: Record<string, DraftRecord> = {};
  for (const [key, draft] of Object.entries(drafts)) {
    if (!draft || draft.accountId === accountId) continue;
    if (draft.version !== DRAFT_VERSION) continue;
    if (typeof draft.expiresAt !== "number" || draft.expiresAt <= now) continue;
    survivors[key] = draft;
  }
  writeAll(survivors);
}
