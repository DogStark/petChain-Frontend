import { useCallback, useMemo, useRef, useState } from 'react';

export interface Slot {
  id: string;
  label: string;
}

export interface BookingResult {
  id: string;
  slotId: string;
}

export interface BookingFormProps {
  slots: Slot[];
  /**
   * Submits a booking for the given slot. Implementations should forward the
   * provided idempotency key so retries of the same intent are deduplicated.
   */
  onSubmit: (input: {
    slotId: string;
    idempotencyKey: string;
    signal: AbortSignal;
  }) => Promise<BookingResult>;
  /** Fetches fresh alternatives after a conflict. */
  onRefreshSlots?: () => Promise<Slot[]>;
}

type Status = 'idle' | 'submitting' | 'success' | 'conflict' | 'error';

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  return status === 409 || code === 'CONFLICT' || code === 'SLOT_TAKEN';
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  return status === 408 || status === 504 || code === 'TIMEOUT';
}

export default function BookingForm({ slots, onSubmit, onRefreshSlots }: BookingFormProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>(slots);

  // One idempotency key per user intent. It is created lazily on the first
  // submit and reused for every retry of that same intent, so double-clicks
  // and network retries can never create more than one booking.
  const intentKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const resetIntent = useCallback(() => {
    intentKeyRef.current = null;
  }, []);

  const handleSlotChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedSlotId(event.target.value);
      // Changing the slot is a new intent.
      resetIntent();
      if (status !== 'idle') {
        setStatus('idle');
        setMessage('');
      }
    },
    [resetIntent, status],
  );

  const refreshAlternatives = useCallback(async () => {
    if (!onRefreshSlots) return;
    try {
      const fresh = await onRefreshSlots();
      setAvailableSlots(fresh);
      // Keep the user's selection if it still exists, otherwise clear it.
      setSelectedSlotId((current) =>
        fresh.some((slot) => slot.id === current) ? current : '',
      );
    } catch {
      // Refreshing alternatives is best-effort; keep the conflict message.
    }
  }, [onRefreshSlots]);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedSlotId) {
        setStatus('error');
        setMessage('Please choose a time slot.');
        return;
      }
      // Guard against double submits while a request is in flight.
      if (inFlightRef.current) return;

      if (!intentKeyRef.current) {
        intentKeyRef.current = createIdempotencyKey();
      }
      const idempotencyKey = intentKeyRef.current;

      inFlightRef.current = true;
      setStatus('submitting');
      setMessage('');

      const controller = new AbortController();
      try {
        await onSubmit({ slotId: selectedSlotId, idempotencyKey, signal: controller.signal });
        setStatus('success');
        setMessage('Your appointment is booked.');
        // Intent completed; the next booking starts a fresh intent.
        resetIntent();
      } catch (error) {
        if (isConflictError(error)) {
          // Preserve the user's entered values and offer refreshed slots.
          setStatus('conflict');
          setMessage('That time was just taken. Here are updated options.');
          await refreshAlternatives();
        } else if (isTimeoutError(error)) {
          // Reconcile: the request may have succeeded server-side. Reuse the
          // same idempotency key so a retry cannot duplicate the booking.
          setStatus('error');
          setMessage(
            'The request timed out. Retrying is safe and will not create a duplicate booking.',
          );
        } else {
          setStatus('error');
          setMessage('Something went wrong. Please try again.');
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [onSubmit, refreshAlternatives, resetIntent, selectedSlotId],
  );

  const isSubmitting = status === 'submitting';
  const slotOptions = useMemo(() => availableSlots, [availableSlots]);

  return (
    <form onSubmit={submit} aria-busy={isSubmitting}>
      <label htmlFor="booking-slot">Time slot</label>
      <select
        id="booking-slot"
        value={selectedSlotId}
        onChange={handleSlotChange}
        disabled={isSubmitting}
      >
        <option value="">Select a time…</option>
        {slotOptions.map((slot) => (
          <option key={slot.id} value={slot.id}>
            {slot.label}
          </option>
        ))}
      </select>

      <button type="submit" disabled={isSubmitting || !selectedSlotId}>
        {isSubmitting ? 'Booking…' : 'Book appointment'}
      </button>

      {status === 'conflict' && (
        <div role="alert">
          <p>{message}</p>
          <button type="button" onClick={refreshAlternatives}>
            Refresh alternatives
          </button>
        </div>
      )}

      {status === 'error' && <p role="alert">{message}</p>}
      {status === 'success' && <p role="status">{message}</p>}
    </form>
  );
}
