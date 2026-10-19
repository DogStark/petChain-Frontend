import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Normalizes a user-entered two-factor recovery code before submission.
 *
 * Recovery codes are frequently pasted with surrounding whitespace, mixed
 * casing, or grouping separators (spaces / dashes). Normalization is purely
 * local and the raw value is never logged or forwarded to analytics.
 */
export function normalizeRecoveryCode(raw: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/[\s-]+/g, '').trim().toUpperCase();
}

/**
 * Server-driven attempt state for recovery-code verification.
 *
 * The client never counts attempts on its own: remaining attempts and the
 * backoff deadline are always derived from the server response so that a
 * refresh cannot be used to reset the brute-force protection.
 */
export interface RecoveryAttemptState {
  /** Attempts remaining before the account is locked, as reported by the server. */
  remainingAttempts: number | null;
  /** Epoch milliseconds at which submission may resume, or null when not locked. */
  lockedUntil: number | null;
  /** True while a verification request is in flight. */
  isSubmitting: boolean;
  /** Generic, account-agnostic error message safe to display to the user. */
  error: string | null;
}

/**
 * Generic messaging. It must never reveal whether an account exists, whether a
 * code was previously used, or any other account-specific detail.
 */
export const GENERIC_RECOVERY_ERROR =
  'That recovery code could not be verified. Please check the code and try again.';

export const LOCKED_RECOVERY_ERROR =
  'Too many attempts. Please wait before trying again.';

/**
 * Shape of the server response for a recovery-code verification request.
 * Only non-sensitive fields are consumed; the submitted code is never echoed.
 */
export interface RecoveryVerifyResponse {
  success: boolean;
  remainingAttempts?: number | null;
  /** Seconds until the caller may retry, when the server has locked the account. */
  retryAfterSeconds?: number | null;
  /** Optional server-provided, already-generic message. */
  message?: string | null;
}

/**
 * Persisted backoff marker. Only the lockout deadline is stored, and only so
 * that a page refresh keeps the user locked out for the documented duration.
 * No codes, tokens, or account identifiers are persisted.
 */
const BACKOFF_STORAGE_KEY = 'recovery.backoffUntil';

function readPersistedBackoff(): number | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const stored = window.sessionStorage.getItem(BACKOFF_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = Number(stored);
    if (!Number.isFinite(parsed) || parsed <= Date.now()) {
      window.sessionStorage.removeItem(BACKOFF_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistBackoff(until: number | null): void {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    if (until && until > Date.now()) {
      window.sessionStorage.setItem(BACKOFF_STORAGE_KEY, String(until));
    } else {
      window.sessionStorage.removeItem(BACKOFF_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); backoff still applies in-memory.
  }
}

/**
 * Verifies a recovery code against the server.
 *
 * The code is sent in the request body only. It is never logged, never added to
 * analytics, and never attached to error telemetry.
 */
async function verifyRecoveryCode(
  code: string,
  signal?: AbortSignal,
): Promise<RecoveryVerifyResponse> {
  const response = await fetch('/api/auth/2fa/recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    signal,
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    return {
      success: false,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
    };
  }

  if (!response.ok) {
    // Do not surface server error bodies: they may contain account details.
    return { success: false };
  }

  return (await response.json()) as RecoveryVerifyResponse;
}

/**
 * Hook that drives the recovery-code form with server-authoritative attempt
 * state and a bounded, refresh-surviving backoff.
 */
export function useRecoveryAttempts() {
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => readPersistedBackoff());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  const isLocked = lockedUntil !== null && lockedUntil > now;

  // Tick while locked so the UI can re-enable submission when backoff expires.
  useEffect(() => {
    if (lockedUntil === null) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil !== null && lockedUntil <= now) {
      setLockedUntil(null);
      persistBackoff(null);
    }
  }, [lockedUntil, now]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = useCallback(
    async (rawCode: string): Promise<boolean> => {
      if (isLocked || isSubmitting) {
        return false;
      }

      const code = normalizeRecoveryCode(rawCode);
      if (!code) {
        setError(GENERIC_RECOVERY_ERROR);
        return false;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await verifyRecoveryCode(code, controller.signal);

        if (result.success) {
          setRemainingAttempts(null);
          setLockedUntil(null);
          persistBackoff(null);
          return true;
        }

        if (typeof result.remainingAttempts === 'number') {
          setRemainingAttempts(result.remainingAttempts);
        }

        if (typeof result.retryAfterSeconds === 'number' && result.retryAfterSeconds > 0) {
          const until = Date.now() + result.retryAfterSeconds * 1000;
          setLockedUntil(until);
          persistBackoff(until);
          setError(LOCKED_RECOVERY_ERROR);
        } else {
          setError(GENERIC_RECOVERY_ERROR);
        }

        return false;
      } catch (err) {
        // Aborted requests are expected on unmount/re-submit; ignore them.
        if ((err as { name?: string })?.name === 'AbortError') {
          return false;
        }
        // Never forward the code or raw error to telemetry.
        setError(GENERIC_RECOVERY_ERROR);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isLocked, isSubmitting],
  );

  const canSubmit = useMemo(
    () => !isLocked && !isSubmitting,
    [isLocked, isSubmitting],
  );

  return {
    remainingAttempts,
    lockedUntil,
    isLocked,
    isSubmitting,
    canSubmit,
    error,
    submit,
    normalizeRecoveryCode,
  };
}

export default useRecoveryAttempts;
