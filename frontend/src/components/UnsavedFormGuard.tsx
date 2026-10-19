import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Secure session-expiry UX for unsaved clinical forms (issue #994).
 *
 * Responsibilities:
 *  - Detect session expiry centrally and freeze submission (no mutations once expired).
 *  - Warn the user before navigating away from an unsaved form.
 *  - Persist a draft only with explicit user consent, encrypted and time-limited.
 *  - Bind drafts to the specific account so a different account cannot restore them.
 */

const DRAFT_TTL_MS = 30 * 60 * 1000; // drafts expire after 30 minutes
const DRAFT_PREFIX = 'clinical:draft:';

interface StoredDraft {
  accountId: string;
  ciphertext: string;
  iv: string;
  expiresAt: number;
}

interface UnsavedFormGuardProps {
  /** Stable identifier for the form, used to scope the draft. */
  formId: string;
  /** Currently authenticated account id. Drafts are bound to this value. */
  accountId: string | null;
  /** Whether the form currently holds unsaved changes. */
  isDirty: boolean;
  /** Serialized form payload to persist as a draft when the user consents. */
  getDraftPayload: () => string;
  /** Called with the decrypted draft payload after re-authentication. */
  onRestoreDraft?: (payload: string) => void;
  /** Called when the session is detected as expired. */
  onSessionExpired?: () => void;
  /** Called to redirect the user to the login screen. */
  onRedirectToLogin?: () => void;
  /** Whether the session is currently considered expired. */
  sessionExpired?: boolean;
  children: React.ReactNode;
}

function draftKey(formId: string): string {
  return `${DRAFT_PREFIX}${formId}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a per-account AES-GCM key. The account id is part of the key material,
 * so a different account cannot decrypt (and therefore cannot restore) the draft.
 */
async function deriveKey(accountId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`clinical-draft:${accountId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('clinical-draft-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptDraft(accountId: string, payload: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(accountId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload));
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

async function decryptDraft(accountId: string, ciphertext: string, iv: string): Promise<string> {
  const key = await deriveKey(accountId);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

function readDraft(formId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(formId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(draftKey(formId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function removeDraft(formId: string): void {
  try {
    window.localStorage.removeItem(draftKey(formId));
  } catch {
    /* storage unavailable */
  }
}

export const UnsavedFormGuard: React.FC<UnsavedFormGuardProps> = ({
  formId,
  accountId,
  isDirty,
  getDraftPayload,
  onRestoreDraft,
  onSessionExpired,
  onRedirectToLogin,
  sessionExpired = false,
  children,
}) => {
  const [expired, setExpired] = useState<boolean>(sessionExpired);
  const [showConsent, setShowConsent] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const pendingNavigation = useRef<string | null>(null);

  // Keep internal expiry state in sync with the centrally detected session state.
  useEffect(() => {
    if (sessionExpired) {
      setExpired(true);
      onSessionExpired?.();
    }
  }, [sessionExpired, onSessionExpired]);

  // Warn before leaving an unsaved form (tab close / reload).
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Warn before in-app navigation away from an unsaved form.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isDirty || expired) return;
      const target = (event.target as HTMLElement | null)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      event.preventDefault();
      pendingNavigation.current = href;
      setShowLeaveWarning(true);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, expired]);

  const handleExpiry = useCallback(() => {
    setExpired(true);
    onSessionExpired?.();
    if (isDirty) {
      setShowConsent(true);
    } else {
      onRedirectToLogin?.();
    }
  }, [isDirty, onSessionExpired, onRedirectToLogin]);

  const handleConsentSave = useCallback(async () => {
    if (!accountId) {
      setShowConsent(false);
      onRedirectToLogin?.();
      return;
    }
    try {
      const payload = getDraftPayload();
      const { ciphertext, iv } = await encryptDraft(accountId, payload);
      const draft: StoredDraft = {
        accountId,
        ciphertext,
        iv,
        expiresAt: Date.now() + DRAFT_TTL_MS,
      };
      window.localStorage.setItem(draftKey(formId), JSON.stringify(draft));
    } catch {
      /* encryption/storage failure: fall through to redirect without a draft */
    }
    setShowConsent(false);
    onRedirectToLogin?.();
  }, [accountId, formId, getDraftPayload, onRedirectToLogin]);

  const handleConsentDecline = useCallback(() => {
    removeDraft(formId);
    setShowConsent(false);
    onRedirectToLogin?.();
  }, [formId, onRedirectToLogin]);

  // Restore a draft only after re-authentication to the same account.
  useEffect(() => {
    if (expired || !accountId || !onRestoreDraft) return;
    const draft = readDraft(formId);
    if (!draft) return;
    if (draft.accountId !== accountId) {
      // A different account must never see the prior draft.
      removeDraft(formId);
      return;
    }
    let cancelled = false;
    decryptDraft(accountId, draft.ciphertext, draft.iv)
      .then((payload) => {
        if (cancelled) return;
        onRestoreDraft(payload);
        removeDraft(formId);
      })
      .catch(() => {
        removeDraft(formId);
      });
    return () => {
      cancelled = true;
    };
  }, [expired, accountId, formId, onRestoreDraft]);

  const handleStay = useCallback(() => {
    pendingNavigation.current = null;
    setShowLeaveWarning(false);
  }, []);

  const handleLeave = useCallback(() => {
    const href = pendingNavigation.current;
    pendingNavigation.current = null;
    setShowLeaveWarning(false);
    if (href) {
      window.location.assign(href);
    }
  }, []);

  return (
    <div data-session-expired={expired ? 'true' : 'false'}>
      {/* Freeze submission: block pointer/submit events while the session is expired. */}
      <fieldset disabled={expired} aria-busy={expired}>
        {children}
      </fieldset>

      {expired && !showConsent && (
        <div role="alert" data-testid="session-expired-banner">
          Your session has expired. Submissions are disabled.
          <button type="button" onClick={handleExpiry}>
            Continue
          </button>
        </div>
      )}

      {showConsent && (
        <div role="dialog" aria-modal="true" data-testid="draft-consent-dialog">
          <p>Your session expired. Save an encrypted draft of your unsaved work?</p>
          <button type="button" onClick={handleConsentSave} data-testid="draft-consent-save">
            Save draft
          </button>
          <button type="button" onClick={handleConsentDecline} data-testid="draft-consent-decline">
            Discard
          </button>
        </div>
      )}

      {showLeaveWarning && (
        <div role="dialog" aria-modal="true" data-testid="unsaved-leave-warning">
          <p>You have unsaved changes. Leave this form?</p>
          <button type="button" onClick={handleStay} data-testid="unsaved-leave-stay">
            Stay
          </button>
          <button type="button" onClick={handleLeave} data-testid="unsaved-leave-confirm">
            Leave
          </button>
        </div>
      )}
    </div>
  );
};

export default UnsavedFormGuard;
