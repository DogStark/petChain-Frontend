/**
 * Debug utilities with privacy-preserving redaction.
 *
 * Debug snapshots and history can accidentally retain tokens, wallet data,
 * contact details, or medical content. This module provides recursive
 * redaction, field allowlists, and bounded retention so sensitive data is
 * never persisted in debug output.
 */

const REDACTED = '[REDACTED]';

/** Keys whose values must always be masked, matched case-insensitively. */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /api[-_]?key/i,
  /auth/i,
  /cookie/i,
  /session/i,
  /wallet/i,
  /private[-_]?key/i,
  /seed[-_]?phrase/i,
  /mnemonic/i,
  /card[-_]?number/i,
  /cvv/i,
  /ssn/i,
  /email/i,
  /phone/i,
  /address/i,
  /contact/i,
  /medical/i,
  /diagnos/i,
  /prescription/i,
  /health/i,
  /patient/i,
];

/** Default maximum number of retained history entries. */
export const DEFAULT_MAX_HISTORY = 50;

/** Default maximum age (ms) of a retained history entry. */
export const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60; // 1 hour

export interface DebugHistoryOptions {
  /** Maximum number of entries to retain. */
  maxEntries?: number;
  /** Maximum age in milliseconds for a retained entry. */
  maxAgeMs?: number;
  /** Optional allowlist of top-level fields to retain. */
  allowlist?: string[];
}

export interface DebugHistoryEntry {
  timestamp: number;
  label: string;
  data: unknown;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redact sensitive values from an arbitrary payload.
 * Handles nested objects and arrays, and guards against cycles.
 */
export function redact<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return '[Circular]' as unknown as T;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redact(val, seen);
    }
  }
  return result as T;
}

/**
 * Retain only allowlisted top-level fields, then redact the remainder.
 * When no allowlist is provided, the full (redacted) payload is returned.
 */
export function applyAllowlist<T>(value: T, allowlist?: string[]): T {
  if (!allowlist || allowlist.length === 0) {
    return value;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      filtered[key] = source[key];
    }
  }
  return filtered as T;
}

/**
 * Produce a safe debug snapshot: allowlist-filtered and recursively redacted.
 */
export function createDebugSnapshot<T>(value: T, allowlist?: string[]): T {
  return redact(applyAllowlist(value, allowlist));
}

/**
 * Bounded debug history. Entries are redacted on insertion and pruned by
 * count and age so sensitive data cannot accumulate unbounded.
 */
export class DebugHistory {
  private entries: DebugHistoryEntry[] = [];
  private readonly maxEntries: number;
  private readonly maxAgeMs: number;
  private readonly allowlist?: string[];

  constructor(options: DebugHistoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_HISTORY;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    this.allowlist = options.allowlist;
  }

  add(label: string, data: unknown, now: number = Date.now()): void {
    const safe = createDebugSnapshot(data, this.allowlist);
    this.entries.push({ timestamp: now, label, data: safe });
    this.prune(now);
  }

  prune(now: number = Date.now()): void {
    this.entries = this.entries.filter((entry) => now - entry.timestamp <= this.maxAgeMs);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxEntries);
    }
  }

  getAll(): DebugHistoryEntry[] {
    return this.entries.slice();
  }

  clear(): void {
    this.entries = [];
  }
}
