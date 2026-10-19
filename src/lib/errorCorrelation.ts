/**
 * Error correlation IDs.
 *
 * A correlation ID links a client-side failure (render exception, rejected
 * loader, boundary recovery) with the corresponding server-side error report
 * so support can find both sides of one incident without exposing any data
 * that could identify a wallet, a pet, or health information.
 *
 * Redaction guarantees (see `redact`):
 * - IDs never contain wallet addresses, pet names/IDs, or health terms.
 * - IDs are bound to a coarse route group ("public" / "protected"), never to
 *   a full URL, query string, or account identifier.
 * - The diagnostics ring buffer stores sanitized digests only; raw error
 *   text and component stacks are logged to the console, never retained here.
 */

// ─── ID generation ────────────────────────────────────────────────────────────

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;
export const CORRELATION_HEADER = 'X-Correlation-Id';

export type RouteGroup = 'public' | 'protected' | 'server';

let cryptoRef: Crypto | null | undefined;

function getCrypto(): Crypto | null {
  if (cryptoRef !== undefined) return cryptoRef;
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    cryptoRef = globalThis.crypto;
  } else {
    cryptoRef = null;
  }
  return cryptoRef;
}

/** Random token from a restricted alphabet — no user data ever enters an ID. */
function randomToken(length: number): string {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(length);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return out;
}

/** Coarse timestamp bucket (seconds) so support can sort incidents by time. */
function timeBucket(): string {
  return Math.floor(Date.now() / 1000).toString(36);
}

/**
 * Generate a correlation ID for an error incident.
 * Shape: `ec-<group>-<bucket>-<random>` (e.g. `ec-protected-lz3k9a-7fq2xh4m1b0d`).
 * Contains only an enum route group, a timestamp bucket, and random characters —
 * no wallet, pet, health, account, or location data by construction.
 */
export function generateCorrelationId(group: RouteGroup = 'server'): string {
  // Defensive: regenerate if the random token accidentally spells a sensitive
  // term (e.g. "pet"). IDs must satisfy the redaction rules by construction.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ec-${group}-${timeBucket()}-${randomToken(ID_LENGTH)}`;
    if (!containsSensitiveData(candidate)) return candidate;
  }
  return `ec-${group}-${timeBucket()}-${randomToken(ID_LENGTH + 4)}`;
}

// ─── Redaction ────────────────────────────────────────────────────────────────

/**
 * Terms that must never appear in a correlation ID or diagnostic digest.
 * Includes wallet/blockchain markers, pet/health vocabulary, and arbitrary
 * account-shaped strings (public keys, UUIDs, emails).
 */
const SENSITIVE_TERM_RE =
  /(wallet|freighter|xlm|stellar|seed|mnemonic|private\s?key|secret|pet|clinic|vet|vaccin|medic|diagnos|surg|allerg|symptom|dose|dosage|appointment|lab\s?result|health|medical|record|blood|disease|illness|chronic|prescription)/i;

/** Stellar public/secret keys, UUIDs, emails, and long hex/base58-ish blobs. */
const SENSITIVE_SHAPE_RE =
  /\b(G[A-Z2-7]{55}|S[A-Z2-7]{55}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w.+-]+@[\w-]+\.[\w.]+)\b/i;

/**
 * True when `candidate` contains anything that could identify a wallet, a
 * pet, or health data. Used defensively before an ID or label is displayed
 * or stored — a generated ID should always pass, but a caller-supplied one
 * might not.
 */
export function containsSensitiveData(candidate: string): boolean {
  if (!candidate) return false;
  return SENSITIVE_TERM_RE.test(candidate) || SENSITIVE_SHAPE_RE.test(candidate);
}

/**
 * Return a display-safe correlation ID. If the supplied value fails the
 * redaction check (or is missing), a fresh safe ID is generated instead so
 * nothing sensitive can leak into the UI or diagnostics.
 */
export function redactCorrelationId(candidate: string | undefined | null, group: RouteGroup = 'server'): string {
  if (candidate && !containsSensitiveData(candidate)) return candidate;
  return generateCorrelationId(group);
}

// ─── Diagnostics ring buffer ──────────────────────────────────────────────────

export interface ErrorDiagnostic {
  correlationId: string;
  /** Coarse route group — never the full URL or query string. */
  routeGroup: RouteGroup;
  /** Stable error-class fingerprint, e.g. "TypeError", "ApiError". */
  errorKind: string;
  /** Monotonic sequence number of the incident in this session. */
  sequence: number;
  /** ISO timestamp of the incident. */
  timestamp: string;
  /** HTTP status when the failure came from a rejected loader/response. */
  status?: number;
}

const MAX_DIAGNOSTICS = 25;

let diagnostics: ErrorDiagnostic[] = [];
let diagnosticSequence = 0;

/** Record a sanitized diagnostic for the most recent error incidents. */
export function recordErrorDiagnostic(input: Omit<ErrorDiagnostic, 'sequence'>): ErrorDiagnostic {
  diagnosticSequence += 1;
  const entry: ErrorDiagnostic = {
    ...input,
    correlationId: redactCorrelationId(input.correlationId, input.routeGroup),
    sequence: diagnosticSequence,
  };
  diagnostics = [...diagnostics, entry].slice(-MAX_DIAGNOSTICS);
  return entry;
}

/** Read the sanitized diagnostics buffer (newest last). */
export function getErrorDiagnostics(): readonly ErrorDiagnostic[] {
  return diagnostics;
}

/** Clear the diagnostics buffer (used between tests / sessions). */
export function clearErrorDiagnostics(): void {
  diagnostics = [];
  diagnosticSequence = 0;
}

// ─── Correlation header helper ────────────────────────────────────────────────

/**
 * Attach the `X-Correlation-Id` header to an outgoing request headers object.
 * API clients call this from their request interceptors so a rejected loader
 * carries the same correlation ID as any boundary error it triggers.
 */
export function attachCorrelationHeader(
  headers: Record<string, string> | undefined,
  group: RouteGroup = 'server',
): Record<string, string> {
  const base = headers ?? {};
  // Axios normalizes header keys to lowercase on outgoing requests; accept
  // either casing so manually-constructed headers are respected too.
  const existing = base[CORRELATION_HEADER] ?? base[CORRELATION_HEADER.toLowerCase()];
  const correlationId = redactCorrelationId(existing, group);
  return { ...base, [CORRELATION_HEADER]: correlationId };
}
