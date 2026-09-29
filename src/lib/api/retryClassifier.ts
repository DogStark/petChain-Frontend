/**
 * Retry Classifier
 *
 * Centralises status/error classification for HTTP API calls so that:
 *  - Non-retryable errors (4xx client errors, conflicts, validation) are
 *    never retried automatically.
 *  - Rate-limit (429) retries respect the server's Retry-After header.
 *  - Mutation retries (POST/PUT/PATCH/DELETE) require an idempotency key
 *    to be present; without one the operation is not retried.
 *  - Transient server failures (5xx) and network errors are retried with
 *    a default back-off.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * HTTP status codes that MUST NOT be retried because the request itself is
 * invalid, forbidden, or will produce the same outcome on every attempt.
 */
const NON_RETRYABLE_STATUSES = new Set([
  400, // Bad Request – malformed syntax
  401, // Unauthorized – missing or invalid credentials
  403, // Forbidden – authenticated but not authorised
  404, // Not Found – resource does not exist
  405, // Method Not Allowed
  409, // Conflict – resource state conflicts (idempotency should prevent this)
  410, // Gone
  413, // Payload Too Large
  415, // Unsupported Media Type
  422, // Unprocessable Entity – validation failure
  431, // Request Header Fields Too Large
]);

/**
 * HTTP status codes that MAY be retried because they represent transient
 * server or gateway failures.
 */
const RETRYABLE_SERVER_STATUSES = new Set([
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTP methods that change server state and therefore need idempotency
 * protection before a retry is attempted.
 */
const MUTATION_METHODS = new Set<string>(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Maximum delay (ms) we are willing to wait for a Retry-After directive. */
const MAX_RETRY_AFTER_MS = 300_000; // 5 minutes

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RetryDecision {
  /** Whether the caller should schedule a retry. */
  shouldRetry: boolean;
  /**
   * Milliseconds the caller should wait before retrying.
   * `null` means the caller should use its own default back-off strategy.
   */
  retryAfterMs: number | null;
  /** Human-readable explanation of the decision. */
  reason: string;
}

export interface ErrorShape {
  response?: {
    status?: number;
    headers?: Record<string, string | string[] | undefined>;
    data?: unknown;
  };
  request?: unknown;
  message?: string;
  code?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Extract the Retry-After value from an error's response headers.
 *
 * Returns `null` when:
 *  - The header is absent.
 *  - The value exceeds `MAX_RETRY_AFTER_MS` (defensive upper bound).
 *
 * The header can be either a `Date` (RFC 1123) or a `seconds` (delta) value
 * per RFC 7231 §7.1.3.
 */
function parseRetryAfter(headers?: Record<string, string | string[] | undefined>): number | null {
  if (!headers) return null;

  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (raw == null) return null;

  // Normalise to a single string value.
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Try delta-seconds first.
  const seconds = parseInt(trimmed, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    const ms = seconds * 1000;
    return ms <= MAX_RETRY_AFTER_MS ? ms : null;
  }

  // Try HTTP-date (RFC 1123 / RFC 850 / ANSI C asctime).
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const ms = Math.max(0, dateMs - Date.now());
    return ms <= MAX_RETRY_AFTER_MS ? ms : null;
  }

  return null;
}

/**
 * Return `true` when the given HTTP method is a state-changing operation
 * that should carry an idempotency key before being retried.
 */
export function isMutationMethod(method?: string): boolean {
  return method != null && MUTATION_METHODS.has(method.toUpperCase());
}

// ── Classifier ──────────────────────────────────────────────────────────────────

/**
 * Classify an API error and decide whether a retry is appropriate.
 *
 * @param error   The error object (from axios / fetch catch).
 * @param method  The HTTP method used for the request (e.g. "GET", "POST").
 *                Mutations require an `idempotencyKey` to be considered for retry.
 * @param hasIdempotencyKey  Whether the original request included an idempotency
 *                header.  When `false` (or omitted), mutations are never retried.
 *
 * @returns A `RetryDecision` describing whether to retry and at what delay.
 */
export function classifyRetry(
  error: ErrorShape,
  method?: string,
  hasIdempotencyKey = false,
): RetryDecision {
  const status = error.response?.status;

  // ── Network / connectivity errors (no response) ──────────────────────────
  if (status == null) {
    // Requests that failed without a response (DNS failure, connection refused,
    // timeout) are safe to retry regardless of method because the server never
    // saw the request, so there is no risk of duplicate side-effects.
    return {
      shouldRetry: true,
      retryAfterMs: null, // use default back-off
      reason: 'Network error – no response received',
    };
  }

  // ── Non-retryable client errors ──────────────────────────────────────────
  if (NON_RETRYABLE_STATUSES.has(status)) {
    return {
      shouldRetry: false,
      retryAfterMs: null,
      reason: `Non-retryable status ${status}`,
    };
  }

  // ── Rate-limit (429) ─────────────────────────────────────────────────────
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(error.response?.headers);
    return {
      shouldRetry: true,
      retryAfterMs,
      reason: retryAfterMs != null
        ? `Rate-limited (429); retry after ${retryAfterMs} ms`
        : 'Rate-limited (429); no Retry-After header',
    };
  }

  // ── Server errors (5xx) ──────────────────────────────────────────────────
  if (RETRYABLE_SERVER_STATUSES.has(status)) {
    // Mutations without idempotency are dangerous to retry automatically.
    if (isMutationMethod(method) && !hasIdempotencyKey) {
      return {
        shouldRetry: false,
        retryAfterMs: null,
        reason: `Server error ${status} on mutation without idempotency key`,
      };
    }
    return {
      shouldRetry: true,
      retryAfterMs: null,
      reason: `Server error ${status}`,
    };
  }

  // ── Unknown / unclassified status ────────────────────────────────────────
  return {
    shouldRetry: false,
    retryAfterMs: null,
    reason: `Unclassified status ${status}`,
  };
}