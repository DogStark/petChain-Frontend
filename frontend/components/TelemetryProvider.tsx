import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Data-classification-aware telemetry wrapper with consent gating and
 * session-replay opt-out for sensitive routes.
 *
 * Issue #948: analytics/session-replay must never capture sensitive fields
 * (inputs, text, URLs, wallet addresses, pet identifiers, health values, maps)
 * and must not emit anything before consent where consent is required.
 */

export type DataClassification =
  | 'public'
  | 'internal'
  | 'sensitive'
  | 'restricted';

export interface TelemetryEvent {
  name: string;
  classification?: DataClassification;
  properties?: Record<string, unknown>;
}

export interface TelemetryConsent {
  analytics: boolean;
  sessionReplay: boolean;
}

export interface TelemetryProviderProps {
  children: React.ReactNode;
  /** Initial consent state; analytics defaults to false (opt-in). */
  initialConsent?: Partial<TelemetryConsent>;
  /** Sink invoked only after consent gating and redaction. */
  onEvent?: (event: TelemetryEvent) => void;
  /** Optional session-replay adapter; disabled on sensitive routes. */
  sessionReplay?: { start: () => void; stop: () => void };
  /** Current route path, used to opt sensitive pages out of replay. */
  pathname?: string;
}

interface TelemetryContextValue {
  consent: TelemetryConsent;
  setConsent: (next: Partial<TelemetryConsent>) => void;
  withdrawConsent: () => void;
  track: (event: TelemetryEvent) => void;
  isSessionReplayEnabled: boolean;
}

const DEFAULT_CONSENT: TelemetryConsent = {
  analytics: false,
  sessionReplay: false,
};

/** Routes that must never be recorded by session replay. */
const REPLAY_OPT_OUT_PATTERNS: RegExp[] = [
  /^\/emergency(\/|$)/i,
  /^\/auth(\/|$)/i,
  /^\/login(\/|$)/i,
  /^\/signin(\/|$)/i,
  /^\/signup(\/|$)/i,
  /^\/register(\/|$)/i,
  /^\/reset-password(\/|$)/i,
];

/** Property keys that are always dropped regardless of classification. */
const SENSITIVE_KEY_PATTERN =
  /(input|text|url|uri|href|wallet|address|pet|animal|health|medical|diagnos|map|geo|location|lat|lng|coord|token|secret|password|email|phone)/i;

/** Value shapes that look like sensitive identifiers. */
const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const URL_VALUE_PATTERN = /^https?:\/\//i;

const REDACTED = '[redacted]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Recursively redact sensitive keys and values. Sensitive/restricted
 * classifications are dropped entirely rather than masked.
 */
export function redactPayload(
  value: unknown,
  classification: DataClassification = 'public',
): unknown {
  if (classification === 'sensitive' || classification === 'restricted') {
    return REDACTED;
  }

  if (typeof value === 'string') {
    if (WALLET_ADDRESS_PATTERN.test(value) || URL_VALUE_PATTERN.test(value)) {
      return REDACTED;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, classification));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = redactPayload(nested, classification);
    }
    return out;
  }

  return value;
}

export function isSessionReplayAllowed(pathname?: string): boolean {
  if (!pathname) {
    return true;
  }
  return !REPLAY_OPT_OUT_PATTERNS.some((pattern) => pattern.test(pathname));
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({
  children,
  initialConsent,
  onEvent,
  sessionReplay,
  pathname,
}: TelemetryProviderProps) {
  const [consent, setConsentState] = useState<TelemetryConsent>({
    ...DEFAULT_CONSENT,
    ...initialConsent,
  });

  // Queue holds events captured while consent is pending; cleared on withdrawal.
  const queueRef = useRef<TelemetryEvent[]>([]);
  const consentRef = useRef(consent);
  consentRef.current = consent;

  const replayAllowed = isSessionReplayAllowed(pathname);
  const isSessionReplayEnabled = consent.sessionReplay && replayAllowed;

  const flushQueue = useCallback(() => {
    if (!onEvent) {
      queueRef.current = [];
      return;
    }
    const pending = queueRef.current;
    queueRef.current = [];
    for (const event of pending) {
      onEvent(event);
    }
  }, [onEvent]);

  const track = useCallback(
    (event: TelemetryEvent) => {
      // No analytics emission before consent where consent is required.
      if (!consentRef.current.analytics) {
        return;
      }
      const redacted: TelemetryEvent = {
        name: event.name,
        classification: event.classification ?? 'public',
        properties: redactPayload(
          event.properties ?? {},
          event.classification ?? 'public',
        ) as Record<string, unknown>,
      };
      if (onEvent) {
        onEvent(redacted);
      }
    },
    [onEvent],
  );

  const setConsent = useCallback(
    (next: Partial<TelemetryConsent>) => {
      setConsentState((prev) => {
        const merged = { ...prev, ...next };
        if (merged.analytics && !prev.analytics) {
          // Opt-in: flush any events queued while consent was pending.
          flushQueue();
        }
        if (!merged.analytics && prev.analytics) {
          // Withdrawal: stop future collection and clear queued events.
          queueRef.current = [];
        }
        return merged;
      });
    },
    [flushQueue],
  );

  const withdrawConsent = useCallback(() => {
    queueRef.current = [];
    setConsentState({ analytics: false, sessionReplay: false });
  }, []);

  // Start/stop session replay based on consent and route opt-out.
  useEffect(() => {
    if (!sessionReplay) {
      return;
    }
    if (isSessionReplayEnabled) {
      sessionReplay.start();
      return () => sessionReplay.stop();
    }
    sessionReplay.stop();
    return undefined;
  }, [sessionReplay, isSessionReplayEnabled]);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      consent,
      setConsent,
      withdrawConsent,
      track,
      isSessionReplayEnabled,
    }),
    [consent, setConsent, withdrawConsent, track, isSessionReplayEnabled],
  );

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return ctx;
}

export default TelemetryProvider;
