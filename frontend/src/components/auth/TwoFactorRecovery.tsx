import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Two-factor recovery code entry with server-driven attempt state and backoff.
 *
 * Security notes:
 * - Recovery codes are never logged, sent to analytics, or included in error telemetry.
 * - Failed attempts always show generic messaging so account existence is not revealed.
 * - Backoff/remaining-attempt state is owned by the server; the client only reflects it.
 */

export interface RecoveryAttemptState {
  /** Remaining attempts reported by the server. */
  remainingAttempts: number;
  /** ISO timestamp until which submission is locked, if any. */
  lockedUntil?: string | null;
  /** Whether the account/code is locked out entirely. */
  locked?: boolean;
}

export interface RecoverySubmitResult {
  ok: boolean;
  /** Server-driven attempt state; present on both success and failure. */
  attemptState?: RecoveryAttemptState;
}

export interface TwoFactorRecoveryProps {
  /**
   * Submits a normalized recovery code. Implementations must not log the code
   * and must return server-driven attempt state.
   */
  onSubmit: (code: string) => Promise<RecoverySubmitResult>;
  /** Optional initial server-driven state (e.g. hydrated from a prior response). */
  initialState?: RecoveryAttemptState;
  /** Called once recovery succeeds. */
  onSuccess?: () => void;
}

const GENERIC_ERROR = 'That recovery code could not be verified. Please try again.';
const LOCKED_ERROR = 'Too many attempts. Please wait before trying again.';

/**
 * Normalizes a recovery code: trims, uppercases, and strips separators/whitespace.
 * Kept pure so it can be unit tested without touching the DOM.
 */
export function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

function parseLockedUntil(state?: RecoveryAttemptState | null): number | null {
  if (!state?.lockedUntil) return null;
  const ts = Date.parse(state.lockedUntil);
  return Number.isNaN(ts) ? null : ts;
}

export default function TwoFactorRecovery({
  onSubmit,
  initialState,
  onSuccess,
}: TwoFactorRecoveryProps) {
  const [code, setCode] = useState('');
  const [attemptState, setAttemptState] = useState<RecoveryAttemptState | null>(
    initialState ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const lockedUntilMs = parseLockedUntil(attemptState);
  const isLocked = Boolean(attemptState?.locked) || (lockedUntilMs !== null && lockedUntilMs > now);

  // Tick while a timed backoff is active so the UI re-enables when it expires.
  useEffect(() => {
    if (lockedUntilMs === null || lockedUntilMs <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntilMs, now]);

  const remainingAttempts = attemptState?.remainingAttempts;
  const canSubmit = useMemo(
    () => !submitting && !isLocked && normalizeRecoveryCode(code).length > 0,
    [submitting, isLocked, code],
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize as the user types so pasted codes with separators are accepted.
    setCode(normalizeRecoveryCode(event.target.value));
    setError(null);
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    // Read from the clipboard event only; never persist or log the value.
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted) return;
    event.preventDefault();
    setCode(normalizeRecoveryCode(pasted));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizeRecoveryCode(code);
      if (!normalized || submitting || isLocked) return;

      setSubmitting(true);
      setError(null);
      try {
        const result = await onSubmit(normalized);
        if (!mountedRef.current) return;

        if (result.attemptState) {
          setAttemptState(result.attemptState);
        }

        if (result.ok) {
          setCode('');
          onSuccess?.();
          return;
        }

        // Generic messaging only; never echo the code or account details.
        const nextLocked =
          Boolean(result.attemptState?.locked) ||
          (parseLockedUntil(result.attemptState) ?? 0) > Date.now();
        setError(nextLocked ? LOCKED_ERROR : GENERIC_ERROR);
      } catch {
        if (!mountedRef.current) return;
        // Do not surface raw error objects (may contain the submitted code).
        setError(GENERIC_ERROR);
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [code, submitting, isLocked, onSubmit, onSuccess],
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="recovery-code">Recovery code</label>
      <input
        id="recovery-code"
        name="recovery-code"
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={handleChange}
        onPaste={handlePaste}
        disabled={submitting || isLocked}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'recovery-code-error' : undefined}
      />

      {error ? (
        <p id="recovery-code-error" role="alert">
          {error}
        </p>
      ) : null}

      {typeof remainingAttempts === 'number' && !isLocked ? (
        <p role="status">
          {remainingAttempts > 0
            ? `You have ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
            : 'No attempts remaining.'}
        </p>
      ) : null}

      <button type="submit" disabled={!canSubmit}>
        {submitting ? 'Verifying…' : 'Verify recovery code'}
      </button>
    </form>
  );
}
