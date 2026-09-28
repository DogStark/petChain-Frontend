import { useCallback, useRef, useState } from 'react';

export interface BookingSlot {
  id: string;
  start: string;
  end: string;
  label?: string;
}

export interface BookingFormValues {
  slotId: string;
  name: string;
  email: string;
  notes?: string;
}

export interface BookingResult {
  id: string;
  slotId: string;
}

export type BookingStatus =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'conflict'
  | 'timeout'
  | 'error';

export interface BookingApi {
  createBooking: (
    values: BookingFormValues,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) => Promise<BookingResult>;
  fetchAlternatives: (slotId: string) => Promise<BookingSlot[]>;
}

export interface UseBookingOptions {
  api: BookingApi;
  /** Timeout in ms before a request is treated as timed out and reconciled. */
  timeoutMs?: number;
  /** Generates a stable idempotency key for a single user intent. */
  generateKey?: () => string;
}

export interface UseBookingResult {
  status: BookingStatus;
  result: BookingResult | null;
  error: string | null;
  /** Preserved form values so the user does not lose input on conflict/timeout. */
  values: BookingFormValues | null;
  /** Refreshed alternative slots offered on conflict. */
  alternatives: BookingSlot[];
  submit: (values: BookingFormValues) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_TIMEOUT_MS = 15000;

function defaultGenerateKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  );
}

function isConflictError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status?: number }).status === 409
  );
}

/**
 * Manages a single appointment booking intent with idempotency and conflict UX.
 *
 * - One intent maps to at most one booking: the idempotency key is generated
 *   once per intent and reused across retries, and concurrent submits are
 *   ignored while a request is in flight.
 * - Timeouts are reconciled by retrying with the same key, so a request that
 *   actually succeeded server-side is not duplicated.
 * - Conflicts preserve the entered form values and load refreshed alternatives.
 */
export function useBooking(options: UseBookingOptions): UseBookingResult {
  const { api, timeoutMs = DEFAULT_TIMEOUT_MS, generateKey = defaultGenerateKey } = options;

  const [status, setStatus] = useState<BookingStatus>('idle');
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<BookingFormValues | null>(null);
  const [alternatives, setAlternatives] = useState<BookingSlot[]>([]);

  // Stable per-intent idempotency key, reused across retries of the same intent.
  const idempotencyKeyRef = useRef<string | null>(null);
  // Guards against double-click / concurrent submissions for the same intent.
  const inFlightRef = useRef(false);

  const loadAlternatives = useCallback(
    async (slotId: string) => {
      try {
        const slots = await api.fetchAlternatives(slotId);
        setAlternatives(slots);
      } catch {
        setAlternatives([]);
      }
    },
    [api],
  );

  const runBooking = useCallback(
    async (formValues: BookingFormValues) => {
      if (inFlightRef.current) {
        // A request for this intent is already in flight; ignore the duplicate.
        return;
      }
      inFlightRef.current = true;
      setStatus('submitting');
      setError(null);

      const key = idempotencyKeyRef.current ?? generateKey();
      idempotencyKeyRef.current = key;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const booking = await api.createBooking(formValues, key, controller.signal);
        setResult(booking);
        setStatus('success');
        setAlternatives([]);
      } catch (err) {
        if (isAbortError(err)) {
          // Timeout: reconcile by retrying with the SAME idempotency key so the
          // server dedupes and we never create a second booking.
          setStatus('timeout');
          setError('The request timed out. Retrying will not create a duplicate booking.');
        } else if (isConflictError(err)) {
          setStatus('conflict');
          setError('That time slot is no longer available.');
          await loadAlternatives(formValues.slotId);
        } else {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Booking failed.');
        }
      } finally {
        clearTimeout(timer);
        inFlightRef.current = false;
      }
    },
    [api, generateKey, loadAlternatives, timeoutMs],
  );

  const submit = useCallback(
    async (formValues: BookingFormValues) => {
      // New user intent: mint a fresh idempotency key and preserve values.
      idempotencyKeyRef.current = generateKey();
      setValues(formValues);
      setResult(null);
      setAlternatives([]);
      await runBooking(formValues);
    },
    [generateKey, runBooking],
  );

  const retry = useCallback(async () => {
    if (!values) return;
    // Reuse the existing idempotency key for the same intent.
    await runBooking(values);
  }, [runBooking, values]);

  const reset = useCallback(() => {
    idempotencyKeyRef.current = null;
    inFlightRef.current = false;
    setStatus('idle');
    setResult(null);
    setError(null);
    setValues(null);
    setAlternatives([]);
  }, []);

  return { status, result, error, values, alternatives, submit, retry, reset };
}
