/**
 * Idempotency key handling for transaction submissions.
 *
 * A key is generated once per transaction attempt and reused for retries of
 * that same attempt so the backend can detect and reject duplicates.
 */

export interface IdempotencyKey {
  /** The opaque key value sent in the request header. */
  key: string;
  /** Timestamp (ms) when the key was generated. */
  createdAt: number;
}

export interface IdempotencyAttempt {
  /** Stable identifier for the logical transaction attempt. */
  attemptId: string;
  /** Idempotency key attached to every request for this attempt. */
  idempotencyKey: IdempotencyKey;
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Generate a new idempotency key for a transaction attempt.
 * Uses crypto.randomUUID when available, with a safe fallback.
 */
export function generateIdempotencyKey(): IdempotencyKey {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  let key: string;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    key = cryptoObj.randomUUID();
  } else if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    key = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  return { key, createdAt: Date.now() };
}

/**
 * Create a new transaction attempt with its own idempotency key.
 */
export function createIdempotencyAttempt(attemptId?: string): IdempotencyAttempt {
  return {
    attemptId: attemptId ?? generateIdempotencyKey().key,
    idempotencyKey: generateIdempotencyKey(),
  };
}

/**
 * Build request headers carrying the idempotency key.
 */
export function buildIdempotencyHeaders(
  attempt: IdempotencyAttempt,
  baseHeaders: Record<string, string> = {},
): Record<string, string> {
  return { ...baseHeaders, [IDEMPOTENCY_HEADER]: attempt.idempotencyKey.key };
}

/**
 * Detect whether a retry would duplicate an already-submitted attempt.
 * Returns true when the same key has already been used for a submission.
 */
export function isDuplicateSubmission(
  attempt: IdempotencyAttempt,
  submittedKeys: ReadonlySet<string> | readonly string[],
): boolean {
  const key = attempt.idempotencyKey.key;
  if (Array.isArray(submittedKeys)) {
    return submittedKeys.includes(key);
  }
  return (submittedKeys as ReadonlySet<string>).has(key);
}
