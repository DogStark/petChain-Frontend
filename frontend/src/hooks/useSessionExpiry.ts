import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Secure session-expiry UX for unsaved clinical forms (issue #994).
 *
 * Responsibilities:
 * - Detect session expiry centrally and freeze mutations/submissions.
 * - Warn the user before navigating away from an unsaved form.
 * - Persist a draft only with explicit user consent, encrypted and time-limited.
 * - Bind drafts to the account so a different account cannot restore them.
 */

const DRAFT_PREFIX = 'clinical-draft:';
const DEFAULT_DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Minimal Web Crypto based encryption for at-rest drafts.
 * The key is derived from the account id so a different account cannot decrypt
 * the prior draft even if it reads the same storage entry.
 */
async function deriveKey(accountId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`clinical-draft-key:${accountId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(`clinical-draft-salt:${accountId}`),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface StoredDraft {
  accountId: string;
  expiresAt: number;
  iv: string;
  ciphertext: string;
}

function draftKey(formId: string): string {
  return `${DRAFT_PREFIX}${formId}`;
}

export interface UseSessionExpiryOptions {
  /** Identifier of the currently authenticated account. */
  accountId: string | null;
  /** Identifier of the clinical form being edited. */
  formId: string;
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /** How long a consented draft remains valid. Defaults to 30 minutes. */
  draftTtlMs?: number;
  /** Called when the session expires so the app can redirect to login. */
  onExpired?: () => void;
}

export interface UseSessionExpiryResult {
  /** True once the session has expired; mutations must be blocked. */
  isExpired: boolean;
  /** True when a valid, account-bound draft exists for this form. */
  hasDraft: boolean;
  /** Mark the session as expired and freeze submissions. */
  markExpired: () => void;
  /** Guard a mutation; returns false and marks expiry when the session is gone. */
  guardMutation: <T>(mutation: () => Promise<T>) => Promise<T | undefined>;
  /** Persist an encrypted, expiring draft after explicit user consent. */
  saveDraft: (data: unknown) => Promise<void>;
  /** Restore the draft for the current account, if any. */
  restoreDraft: <T = unknown>() => Promise<T | null>;
  /** Remove the stored draft. */
  clearDraft: () => void;
}

export function useSessionExpiry({
  accountId,
  formId,
  isDirty,
  draftTtlMs = DEFAULT_DRAFT_TTL_MS,
  onExpired,
}: UseSessionExpiryOptions): UseSessionExpiryResult {
  const [isExpired, setIsExpired] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const expiredRef = useRef(false);

  const markExpired = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setIsExpired(true);
    onExpired?.();
  }, [onExpired]);

  // Warn before leaving an unsaved form.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Detect expiry centrally via a session-expired event.
  useEffect(() => {
    const handler = () => markExpired();
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [markExpired]);

  const guardMutation = useCallback(
    async <T,>(mutation: () => Promise<T>): Promise<T | undefined> => {
      if (expiredRef.current) return undefined;
      try {
        return await mutation();
      } catch (error) {
        const status = (error as { status?: number } | undefined)?.status;
        if (status === 401 || status === 403) {
          markExpired();
          return undefined;
        }
        throw error;
      }
    },
    [markExpired],
  );

  const saveDraft = useCallback(
    async (data: unknown) => {
      if (!accountId) return;
      const key = await deriveKey(accountId);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(data));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const stored: StoredDraft = {
        accountId,
        expiresAt: Date.now() + draftTtlMs,
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(ciphertext)),
      };
      localStorage.setItem(draftKey(formId), JSON.stringify(stored));
      setHasDraft(true);
    },
    [accountId, formId, draftTtlMs],
  );

  const restoreDraft = useCallback(
    async <T = unknown,>(): Promise<T | null> => {
      if (!accountId) return null;
      const raw = localStorage.getItem(draftKey(formId));
      if (!raw) return null;
      let stored: StoredDraft;
      try {
        stored = JSON.parse(raw) as StoredDraft;
      } catch {
        localStorage.removeItem(draftKey(formId));
        return null;
      }
      // Account binding: a different account must never see the prior draft.
      if (stored.accountId !== accountId) return null;
      // Expiring drafts: drop anything past its TTL.
      if (Date.now() > stored.expiresAt) {
        localStorage.removeItem(draftKey(formId));
        setHasDraft(false);
        return null;
      }
      try {
        const key = await deriveKey(accountId);
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromBase64(stored.iv) },
          key,
          fromBase64(stored.ciphertext),
        );
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
      } catch {
        localStorage.removeItem(draftKey(formId));
        setHasDraft(false);
        return null;
      }
    },
    [accountId, formId],
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey(formId));
    setHasDraft(false);
  }, [formId]);

  return {
    isExpired,
    hasDraft,
    markExpired,
    guardMutation,
    saveDraft,
    restoreDraft,
    clearDraft,
  };
}
