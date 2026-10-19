/**
 * Browser privacy controls for analytics and session replay.
 *
 * Provides a data-classification-aware telemetry wrapper, consent gating,
 * and DOM redaction helpers so that sensitive fields (inputs, text, URLs,
 * wallet addresses, pet identifiers, health values, maps) are excluded or
 * masked by default, and emergency/authentication pages opt out of session
 * replay entirely.
 */

export type ConsentCategory = "analytics" | "sessionReplay";

export type DataClassification =
  | "public"
  | "internal"
  | "sensitive"
  | "restricted";

export interface ConsentState {
  analytics: boolean;
  sessionReplay: boolean;
}

export interface TelemetryEvent {
  name: string;
  classification?: DataClassification;
  properties?: Record<string, unknown>;
}

export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

const CONSENT_STORAGE_KEY = "handsoff.consent.v1";

const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  sessionReplay: false,
};

/**
 * Fields that must never leave the browser in telemetry payloads, regardless
 * of consent. Matched case-insensitively against property keys.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
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

const MASK = "[redacted]";

/**
 * Routes that must never be recorded by session replay. Emergency and
 * authentication flows are excluded entirely.
 */
const REPLAY_OPT_OUT_PATTERNS: RegExp[] = [
  /\/emergency/i,
  /\/auth/i,
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/signup/i,
  /\/sign-up/i,
  /\/register/i,
  /\/reset-password/i,
  /\/forgot-password/i,
  /\/verify/i,
  /\/otp/i,
];

let consent: ConsentState = { ...DEFAULT_CONSENT };
let queuedEvents: TelemetryEvent[] = [];
let sink: TelemetrySink | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadConsent(): ConsentState {
  if (!isBrowser()) {
    return { ...DEFAULT_CONSENT };
  }
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_CONSENT };
    }
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      analytics: parsed.analytics === true,
      sessionReplay: parsed.sessionReplay === true,
    };
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

function persistConsent(next: ConsentState): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode); consent stays in memory.
  }
}

consent = loadConsent();

export function getConsent(): ConsentState {
  return { ...consent };
}

export function hasConsent(category: ConsentCategory): boolean {
  return consent[category] === true;
}

/**
 * Update consent. Withdrawing consent stops future collection and clears any
 * queued events so nothing sensitive is flushed after opt-out.
 */
export function setConsent(next: Partial<ConsentState>): ConsentState {
  consent = {
    analytics: next.analytics ?? consent.analytics,
    sessionReplay: next.sessionReplay ?? consent.sessionReplay,
  };
  persistConsent(consent);

  if (!consent.analytics) {
    queuedEvents = [];
  }
  if (!consent.sessionReplay) {
    stopSessionReplay();
  }
  return getConsent();
}

export function withdrawConsent(): ConsentState {
  return setConsent({ analytics: false, sessionReplay: false });
}

export function registerTelemetrySink(next: TelemetrySink | null): void {
  sink = next;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively mask sensitive values in a telemetry payload. Sensitive keys
 * are replaced with a mask; nested objects and arrays are traversed.
 */
export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? MASK : redactPayload(nested, depth + 1);
    }
    return result;
  }
  return value;
}

/**
 * Emit a telemetry event. Events are dropped unless analytics consent is
 * granted; sensitive properties are redacted before reaching the sink.
 */
export function track(event: TelemetryEvent): void {
  if (!hasConsent("analytics")) {
    return;
  }
  const safeEvent: TelemetryEvent = {
    name: event.name,
    classification: event.classification ?? "internal",
    properties: redactPayload(event.properties ?? {}) as Record<string, unknown>,
  };
  if (sink) {
    sink.emit(safeEvent);
  } else {
    queuedEvents.push(safeEvent);
  }
}

/**
 * Flush queued events to the sink. Only runs while analytics consent is held;
 * otherwise the queue is cleared.
 */
export function flushTelemetry(): void {
  if (!hasConsent("analytics")) {
    queuedEvents = [];
    return;
  }
  if (!sink) {
    return;
  }
  const pending = queuedEvents;
  queuedEvents = [];
  for (const event of pending) {
    sink.emit(event);
  }
}

export function getQueuedEventCount(): number {
  return queuedEvents.length;
}

/**
 * Whether session replay is permitted for the given path. Emergency and
 * authentication routes always opt out.
 */
export function isSessionReplayAllowed(path: string): boolean {
  if (!hasConsent("sessionReplay")) {
    return false;
  }
  return !REPLAY_OPT_OUT_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * Apply default DOM redaction attributes to sensitive elements so replay
 * tooling masks them. Safe to call repeatedly.
 */
export function applyDomRedaction(root?: ParentNode): void {
  if (!isBrowser()) {
    return;
  }
  const scope: ParentNode = root ?? document;
  const selector = "input, textarea, select, [data-sensitive], [data-wallet], [data-health], [data-map]";
  scope.querySelectorAll(selector).forEach((element) => {
    element.setAttribute("data-replay-mask", "true");
    element.setAttribute("data-analytics-exclude", "true");
  });
}

/**
 * Start session replay only when consent is granted and the current route is
 * not an emergency/authentication page.
 */
export function startSessionReplay(path: string): boolean {
  if (!isSessionReplayAllowed(path)) {
    stopSessionReplay();
    return false;
  }
  applyDomRedaction();
  return true;
}

export function stopSessionReplay(): void {
  // Replay tooling is expected to observe consent state; nothing to tear down
  // beyond ensuring no further capture is requested.
}

export function resetConsentForTests(): void {
  consent = { ...DEFAULT_CONSENT };
  queuedEvents = [];
  sink = null;
}
