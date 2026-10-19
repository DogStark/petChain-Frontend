import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bounded, opt-in form draft protection for browser refresh and back navigation.
 *
 * Policy:
 * - Drafts are only ever restored after an explicit user choice (restore prompt).
 * - Drafts are minimized: only the fields the caller opts into are persisted.
 * - Drafts are versioned; a version mismatch purges the stored draft.
 * - Drafts are account-bound; an account mismatch purges the stored draft.
 * - Drafts expire; an expired draft is purged on read.
 * - The store is bounded by a max age and a max serialized size.
 */

export const FORM_DRAFT_VERSION = 1;

const STORAGE_PREFIX = 'form-draft:';
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours
const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KB minimized payload

interface StoredDraft<T> {
  version: number;
  accountId: string;
  savedAt: number;
  data: T;
}

export interface UseFormDraftOptions<T> {
  /** Stable key identifying the form (e.g. "patient-intake"). */
  key: string;
  /** Current account id; drafts are bound to it and purged on mismatch. */
  accountId: string | null | undefined;
  /** Current form values. */
  values: T;
  /** Only these fields are persisted (minimization policy). */
  fields: ReadonlyArray<keyof T>;
  /** Whether draft protection is active for this form. */
  enabled?: boolean;
  /** Max age before a draft is considered expired. */
  maxAgeMs?: number;
  /** Max serialized size in bytes before a draft is rejected. */
  maxBytes?: number;
}

export interface UseFormDraftResult<T> {
  /** A pending draft awaiting an explicit user decision, or null. */
  pendingDraft: T | null;
  /** Accept the pending draft (applies it via onRestore). */
  restoreDraft: () => void;
  /** Decline the pending draft; it is purged. */
  discardDraft: () => void;
  /** Purge any stored draft for this key/account. */
  clearDraft: () => void;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function purge(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    /* ignore quota/security errors */
  }
}

function minimize<T>(values: T, fields: ReadonlyArray<keyof T>): Partial<T> {
  const out: Partial<T> = {};
  for (const field of fields) {
    out[field] = values[field];
  }
  return out;
}

/**
 * Reads a stored draft, purging it when it is expired, version-mismatched,
 * account-mismatched, or malformed. Returns null when nothing is restorable.
 */
function readDraft<T>(
  key: string,
  accountId: string,
  maxAgeMs: number,
): T | null {
  const storage = safeStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(key));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: StoredDraft<T>;
  try {
    parsed = JSON.parse(raw) as StoredDraft<T>;
  } catch {
    purge(key);
    return null;
  }

  const expired =
    typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > maxAgeMs;
  const versionMismatch = parsed.version !== FORM_DRAFT_VERSION;
  const accountMismatch = parsed.accountId !== accountId;

  if (expired || versionMismatch || accountMismatch || !parsed.data) {
    purge(key);
    return null;
  }

  return parsed.data;
}

/**
 * Opt-in draft protection hook. Persists a minimized snapshot of the form and
 * surfaces a pending draft that must be explicitly accepted by the user.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  options: UseFormDraftOptions<T>,
  onRestore: (draft: T) => void,
): UseFormDraftResult<T> {
  const {
    key,
    accountId,
    values,
    fields,
    enabled = true,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

  const [pendingDraft, setPendingDraft] = useState<T | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Detect a restorable draft on mount / account change. Never auto-applies.
  useEffect(() => {
    if (!enabled || !accountId) {
      setPendingDraft(null);
      return;
    }
    const draft = readDraft<T>(key, accountId, maxAgeMs);
    setPendingDraft(draft);
  }, [enabled, accountId, key, maxAgeMs]);

  // Persist a minimized snapshot as the user edits.
  useEffect(() => {
    if (!enabled || !accountId) return;
    const storage = safeStorage();
    if (!storage) return;

    const payload: StoredDraft<Partial<T>> = {
      version: FORM_DRAFT_VERSION,
      accountId,
      savedAt: Date.now(),
      data: minimize(values, fields),
    };

    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      return;
    }

    // Bounded store: reject oversized payloads rather than persist them.
    if (serialized.length > maxBytes) {
      purge(key);
      return;
    }

    try {
      storage.setItem(storageKey(key), serialized);
    } catch {
      /* ignore quota/security errors */
    }
  }, [enabled, accountId, key, values, fields, maxBytes]);

  const restoreDraft = useCallback(() => {
    setPendingDraft((draft) => {
      if (draft) onRestoreRef.current(draft);
      return null;
    });
  }, []);

  const discardDraft = useCallback(() => {
    purge(key);
    setPendingDraft(null);
  }, [key]);

  const clearDraft = useCallback(() => {
    purge(key);
    setPendingDraft(null);
  }, [key]);

  return { pendingDraft, restoreDraft, discardDraft, clearDraft };
}
