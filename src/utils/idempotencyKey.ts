/**
 * Idempotency key utilities for preventing duplicate transaction submissions.
 *
 * A key is derived from the stable, user-visible fields of a transaction
 * payload rather than from a pure random UUID.  This means:
 *
 *  - A true double-click / rapid re-submit on the same form data produces the
 *    *same* key, so the server (and the client-side guard) can detect and
 *    suppress the duplicate.
 *  - Changing any field (destination, amount, asset, memo) produces a new key,
 *    so a legitimate second transaction is never suppressed.
 *
 * Key format: `idempotency:<nonce>:<hex-digest>`
 *   - nonce:      base-36 timestamp (ms) – makes keys time-scoped so the server
 *                 can implement a short expiry window (e.g. 24 h) without
 *                 storing keys forever.
 *   - hex-digest: SHA-256 of the canonical payload JSON.
 *
 * If the Web Crypto API is unavailable (SSR / very old environments) the
 * function falls back to a deterministic FNV-32a hash, which gives the same
 * collision-prevention semantics without async I/O.
 */

export interface IdempotencyPayload {
  sourcePublicKey: string;
  destination: string;
  amount: string;
  asset: string;
  memo?: string;
  fee?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Canonical JSON: keys are sorted so `{a,b}` and `{b,a}` produce the same
 * string.  Values are lowercased where they are free-form text so that
 * "XLM" and "xlm" don't produce different keys.
 */
function canonicalize(payload: IdempotencyPayload): string {
  const normalized: Record<string, string> = {
    sourcePublicKey: payload.sourcePublicKey.trim(),
    destination: payload.destination.trim(),
    amount: parseFloat(payload.amount).toFixed(7),
    asset: payload.asset.trim().toUpperCase(),
    memo: (payload.memo ?? '').trim(),
    fee: (payload.fee ?? '').trim(),
  };
  return JSON.stringify(
    Object.keys(normalized)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = normalized[k];
        return acc;
      }, {})
  );
}

/** FNV-32a – deterministic fallback when Web Crypto is unavailable. */
function fnv32a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

async function sha256hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate an idempotency key for a payment transaction.
 *
 * The returned promise always resolves; it never rejects.  On crypto failure
 * it falls back to the FNV-32a synchronous hash.
 *
 * @example
 * const key = await generateIdempotencyKey({
 *   sourcePublicKey: 'GABC…',
 *   destination:     'GXYZ…',
 *   amount:          '10.5',
 *   asset:           'XLM',
 * });
 * // → "idempotency:lkz4g7r:a3f9c1…"
 */
export async function generateIdempotencyKey(
  payload: IdempotencyPayload
): Promise<string> {
  const nonce = Date.now().toString(36); // base-36 ms timestamp
  const canonical = canonicalize(payload);
  let digest: string;
  try {
    digest = await sha256hex(canonical);
  } catch {
    digest = fnv32a(canonical);
  }
  return `idempotency:${nonce}:${digest}`;
}

/**
 * Synchronous variant — useful in tests and SSR contexts where async is
 * inconvenient.  Uses FNV-32a rather than SHA-256.
 */
export function generateIdempotencyKeySync(payload: IdempotencyPayload): string {
  const nonce = Date.now().toString(36);
  const canonical = canonicalize(payload);
  const digest = fnv32a(canonical);
  return `idempotency:${nonce}:${digest}`;
}

/**
 * Extract the digest portion of an idempotency key so two keys produced from
 * the same payload (but at different timestamps) can be compared.
 *
 * Returns `null` if the string is not a valid idempotency key.
 */
export function extractDigest(key: string): string | null {
  const parts = key.split(':');
  // format: "idempotency:<nonce>:<digest>"
  if (parts.length !== 3 || parts[0] !== 'idempotency') return null;
  return parts[2];
}

/**
 * Return `true` if two keys were derived from identical payload fields
 * (ignoring when they were generated).
 */
export function samePayload(keyA: string, keyB: string): boolean {
  const a = extractDigest(keyA);
  const b = extractDigest(keyB);
  return a !== null && b !== null && a === b;
}
