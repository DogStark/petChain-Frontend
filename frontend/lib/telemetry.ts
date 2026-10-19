/**
 * Data-classification-aware telemetry wrapper.
 *
 * Guarantees:
 *  - No analytics event is emitted before consent where consent is required.
 *  - Sensitive fields (inputs, text, URLs, wallet addresses, pet identifiers,
 *    health values, maps) are excluded or masked by default.
 *  - Emergency and authentication pages opt out of session replay entirely.
 *  - Consent withdrawal stops future collection and clears queued events.
 */

export type DataClassification =
  | 'public'
  | 'internal'
  | 'sensitive'
  | 'restricted';

export type ConsentState = 'granted' | 'denied' | 'unknown';

export interface TelemetryEvent {
  name: string;
  classification?: DataClassification;
  properties?: Record<string, unknown>;
}

export interface TelemetryConfig {
  /** Whether analytics requires explicit opt-in before any event is sent. */
  requiresConsent?: boolean;
  /** Whether session replay is enabled at all for this build. */
  sessionReplayEnabled?: boolean;
  /** Current route/path, used to opt sensitive pages out of replay. */
  pathname?: string;
}

/**
 * Field names that are always treated as sensitive regardless of the event's
 * declared classification. Matching is case-insensitive and substring-based so
 * variants like `walletAddress`, `pet_id`, or `userEmail` are caught.
 */
const SENSITIVE_FIELD_PATTERNS: readonly RegExp[] = [
  /input/i,
  /text/i,
  /url/i,
  /link/i,
  /href/i,
  /wallet/i,
  /address/i,
  /pet/i,
  /animal/i,
  /health/i,
  /medical/i,
  /diagnos/i,
  /symptom/i,
  /location/i,
  /geo/i,
  /lat/i,
  /lng/i,
  /map/i,
  /coord/i,
  /email/i,
  /phone/i,
  /name/i,
  /token/i,
  /secret/i,
  /password/i,
];

/** Routes that must never be recorded by session replay. */
const REPLAY_OPT_OUT_PATTERNS: readonly RegExp[] = [
  /^\/emergency/i,
  /^\/auth/i,
  /^\/login/i,
  /^\/signin/i,
  /^\/sign-in/i,
  /^\/signup/i,
  /^\/sign-up/i,
  /^\/register/i,
  /^\/reset-password/i,
  /^\/forgot-password/i,
];

const MASK = '[redacted]';

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redact sensitive values from a payload. Sensitive keys are
 * replaced with a mask; nested objects/arrays are walked so deeply nested
 * values cannot leak either.
 */
export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return MASK;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? MASK : redactPayload(nested, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Returns true when the given path must opt out of session replay entirely.
 */
export function shouldOptOutOfReplay(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return REPLAY_OPT_OUT_PATTERNS.some((pattern) => pattern.test(pathname));
}

type Sink = (event: TelemetryEvent) => void;

/**
 * Consent-gated telemetry client. Events emitted before consent (when consent
 * is required) are queued, not sent. Withdrawing consent stops future
 * collection and clears the queue.
 */
export class TelemetryClient {
  private consent: ConsentState = 'unknown';
  private queue: TelemetryEvent[] = [];
  private readonly requiresConsent: boolean;
  private readonly sink: Sink;
  private replayEnabled: boolean;
  private pathname?: string;

  constructor(config: TelemetryConfig = {}, sink?: Sink) {
    this.requiresConsent = config.requiresConsent ?? true;
    this.replayEnabled = config.sessionReplayEnabled ?? false;
    this.pathname = config.pathname;
    this.sink = sink ?? (() => undefined);
  }

  setPathname(pathname: string | undefined): void {
    this.pathname = pathname;
  }

  getConsent(): ConsentState {
    return this.consent;
  }

  /**
   * Record consent. Granting flushes queued events; denying/withdrawing stops
   * collection and clears the queue.
   */
  setConsent(state: ConsentState): void {
    this.consent = state;
    if (state === 'granted') {
      this.flush();
    } else {
      this.queue = [];
    }
  }

  /** Withdraw consent: stop future collection and clear queued events. */
  withdrawConsent(): void {
    this.setConsent('denied');
  }

  private canEmit(): boolean {
    if (!this.requiresConsent) return true;
    return this.consent === 'granted';
  }

  /**
   * Emit a telemetry event. Sensitive fields are redacted before the event is
   * queued or sent. Events are dropped when consent is denied and queued when
   * consent is still unknown.
   */
  track(event: TelemetryEvent): void {
    if (this.consent === 'denied') return;

    const safeEvent: TelemetryEvent = {
      ...event,
      properties: event.properties
        ? (redactPayload(event.properties) as Record<string, unknown>)
        : undefined,
    };

    if (this.canEmit()) {
      this.sink(safeEvent);
      return;
    }
    this.queue.push(safeEvent);
  }

  /** Flush queued events once consent is granted. */
  flush(): void {
    if (!this.canEmit()) return;
    const pending = this.queue;
    this.queue = [];
    for (const event of pending) {
      this.sink(event);
    }
  }

  /**
   * Whether session replay should record the current page. Replay is disabled
   * globally when not enabled, and always disabled on emergency/auth routes.
   */
  isReplayAllowed(): boolean {
    if (!this.replayEnabled) return false;
    if (this.requiresConsent && this.consent !== 'granted') return false;
    return !shouldOptOutOfReplay(this.pathname);
  }
}

export const telemetry = new TelemetryClient();
