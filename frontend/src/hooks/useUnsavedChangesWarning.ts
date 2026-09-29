import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bounded, opt-in draft store for long clinical forms.
 *
 * Guarantees:
 * - Drafts are never restored without explicit user choice (restore prompt).
 * - Drafts are minimized according to policy (only allow-listed fields are kept).
 * - Expired drafts and account-mismatched drafts are purged.
 * - The store is bounded by both entry count and per-entry size, and versioned.
 */

const DRAFT_STORE_VERSION = 1;
const DRAFT_KEY_PREFIX = 'clinical-form-draft:';
const DRAFT_MAX_ENTRIES = 10;
const DRAFT_MAX_BYTES = 64 * 1024;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Fields that are safe to persist. Anything else is dropped (minimization). */
const DRAFT_ALLOWED_FIELDS = [
  'patientId',
  'encounterId',
  'notes',
  'diagnosis',
  'medications',
  'allergies',
  'vitals',
  'assessment',
  'plan',
];

interface DraftEnvelope<T> {
  version: number;
  accountId: string;
  formId: string;
  savedAt: number;
  expiresAt: number;
  data: T;
}

interface DraftMeta {
  formId: string;
  savedAt: number;
  expiresAt: number;
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function draftKey(formId: string): string {
  return `${DRAFT_KEY_PREFIX}${formId}`;
}

/** Keep only allow-listed fields so drafts stay minimized per policy. */
function minimize<T extends Record<string, unknown>>(values: T): Partial<T> {
  const out: Partial<T> = {};
  for (const field of DRAFT_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(values, field)) {
      out[field as keyof T] = values[field as keyof T];
    }
  }
  return out;
}

function isExpired(envelope: DraftEnvelope<unknown>): boolean {
  return typeof envelope.expiresAt !== 'number' || envelope.expiresAt <= Date.now();
}

function readEnvelope<T>(formId: string): DraftEnvelope<T> | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(formId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || parsed.version !== DRAFT_STORE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function removeDraft(formId: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(draftKey(formId));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Purge expired drafts and drafts belonging to a different account. */
function purgeStaleDrafts(accountId: string): void {
  if (!storageAvailable()) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as DraftEnvelope<unknown>;
        if (
          !parsed ||
          parsed.version !== DRAFT_STORE_VERSION ||
          isExpired(parsed) ||
          parsed.accountId !== accountId
        ) {
          stale.push(key);
        }
      } catch {
        stale.push(key);
      }
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Enforce the entry-count bound by evicting the oldest drafts first. */
function enforceEntryBound(): void {
  if (!storageAvailable()) return;
  try {
    const entries: DraftMeta[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as DraftEnvelope<unknown>;
        entries.push({ formId: key.slice(DRAFT_KEY_PREFIX.length), savedAt: parsed.savedAt, expiresAt: parsed.expiresAt });
      } catch {
        entries.push({ formId: key.slice(DRAFT_KEY_PREFIX.length), savedAt: 0, expiresAt: 0 });
      }
    }
    if (entries.length <= DRAFT_MAX_ENTRIES) return;
    entries
      .sort((a, b) => a.savedAt - b.savedAt)
      .slice(0, entries.length - DRAFT_MAX_ENTRIES)
      .forEach((entry) => removeDraft(entry.formId));
  } catch {
    /* ignore */
  }
}

function writeDraft<T extends Record<string, unknown>>(
  formId: string,
  accountId: string,
  values: T,
): void {
  if (!storageAvailable()) return;
  const now = Date.now();
  const envelope: DraftEnvelope<Partial<T>> = {
    version: DRAFT_STORE_VERSION,
    accountId,
    formId,
    savedAt: now,
    expiresAt: now + DRAFT_TTL_MS,
    data: minimize(values),
  };
  let serialized = JSON.stringify(envelope);
  if (serialized.length > DRAFT_MAX_BYTES) {
    // Too large to persist safely; drop rather than exceed the bound.
    removeDraft(formId);
    return;
  }
  try {
    window.localStorage.setItem(draftKey(formId), serialized);
    enforceEntryBound();
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Read a draft for the current account. Returns null when the draft is missing,
 * expired, version-mismatched, or belongs to another account (and purges it).
 */
function readDraft<T>(formId: string, accountId: string): T | null {
  const envelope = readEnvelope<T>(formId);
  if (!envelope) return null;
  if (isExpired(envelope) || envelope.accountId !== accountId) {
    removeDraft(formId);
    return null;
  }
  return envelope.data;
}

interface UseUnsavedChangesWarningOptions {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /** Optional custom message for the native beforeunload prompt. */
  message?: string;
  /** Stable identifier for the form, used to key its draft. */
  formId?: string;
  /** Account the draft is bound to; mismatched drafts are purged. */
  accountId?: string;
  /** Current form values, persisted as a minimized draft when dirty. */
  values?: Record<string, unknown>;
  /** Whether draft persistence is enabled (opt-in). */
  enabled?: boolean;
}

interface UseUnsavedChangesWarningResult {
  /** Draft awaiting an explicit restore decision, or null. */
  pendingDraft: Record<string, unknown> | null;
  /** Accept the pending draft (explicit user choice). */
  restoreDraft: () => void;
  /** Decline the pending draft; it is purged. */
  discardDraft: () => void;
  /** Remove the stored draft for this form. */
  clearDraft: () => void;
}

/**
 * Warns on browser refresh/back navigation when a form is dirty and, when
 * enabled, persists a bounded, versioned, account-bound draft that is only
 * restored after the user explicitly accepts it.
 */
export function useUnsavedChangesWarning({
  isDirty,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  formId,
  accountId,
  values,
  enabled = false,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningResult {
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const draftEnabled = enabled && !!formId && !!accountId;

  // Warn on refresh / back navigation while dirty.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  // Persist a minimized draft while dirty; purge it once the form is clean.
  useEffect(() => {
    if (!draftEnabled || !formId || !accountId) return;
    if (isDirty && valuesRef.current) {
      writeDraft(formId, accountId, valuesRef.current);
    } else if (!isDirty) {
      removeDraft(formId);
    }
  }, [draftEnabled, formId, accountId, isDirty, values]);

  // On mount, purge stale drafts and surface a recoverable draft for explicit choice.
  useEffect(() => {
    if (!draftEnabled || !formId || !accountId) return;
    purgeStaleDrafts(accountId);
    const draft = readDraft<Record<string, unknown>>(formId, accountId);
    if (draft) setPendingDraft(draft);
  }, [draftEnabled, formId, accountId]);

  const restoreDraft = useCallback(() => {
    setPendingDraft(null);
  }, []);

  const discardDraft = useCallback(() => {
    if (formId) removeDraft(formId);
    setPendingDraft(null);
  }, [formId]);

  const clearDraft = useCallback(() => {
    if (formId) removeDraft(formId);
  }, [formId]);

  return { pendingDraft, restoreDraft, discardDraft, clearDraft };
}

export default useUnsavedChangesWarning;
