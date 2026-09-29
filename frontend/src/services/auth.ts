import { apiClient } from './apiClient';

export interface RecoveryAttemptState {
  remainingAttempts: number;
  lockedUntil: string | null;
  backoffSeconds: number;
}

export interface RecoveryResult {
  success: boolean;
  state: RecoveryAttemptState;
}

const GENERIC_RECOVERY_ERROR = 'Invalid or expired recovery code. Please try again.';

/**
 * Normalize a recovery code before submission.
 * Trims, uppercases, and strips separators/whitespace so users can paste
 * codes with dashes, spaces, or mixed case without leaking the raw value.
 */
export function normalizeRecoveryCode(raw: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

function parseAttemptState(data: unknown): RecoveryAttemptState {
  const source = (data ?? {}) as Record<string, unknown>;
  const remaining = Number(source.remainingAttempts);
  const backoff = Number(source.backoffSeconds);
  return {
    remainingAttempts: Number.isFinite(remaining) && remaining >= 0 ? remaining : 0,
    lockedUntil: typeof source.lockedUntil === 'string' ? source.lockedUntil : null,
    backoffSeconds: Number.isFinite(backoff) && backoff > 0 ? backoff : 0,
  };
}

/**
 * Submit a two-factor recovery code.
 *
 * The raw code is never logged, attached to analytics, or included in error
 * telemetry. Only the normalized code is sent to the server, and the server
 * is the source of truth for remaining attempts and lockout/backoff state.
 */
export async function submitRecoveryCode(rawCode: string): Promise<RecoveryResult> {
  const code = normalizeRecoveryCode(rawCode);

  if (!code) {
    return {
      success: false,
      state: { remainingAttempts: 0, lockedUntil: null, backoffSeconds: 0 },
    };
  }

  try {
    const response = await apiClient.post('/auth/2fa/recovery', { code });
    return {
      success: true,
      state: parseAttemptState(response?.data),
    };
  } catch (error) {
    const status = (error as { response?: { status?: number; data?: unknown } })?.response;
    const state = parseAttemptState(status?.data);

    // Surface only generic messaging; never echo the submitted code or
    // server internals that could reveal whether an account exists.
    const message =
      status?.status === 429 || state.lockedUntil
        ? 'Too many attempts. Please wait before trying again.'
        : GENERIC_RECOVERY_ERROR;

    return {
      success: false,
      state: { ...state, message } as RecoveryAttemptState & { message: string },
    };
  }
}
