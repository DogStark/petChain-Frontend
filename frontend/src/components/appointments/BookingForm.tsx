'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Booking form for scheduling a pet appointment.
 *
 * When the backend reports that the chosen slot is no longer available, the
 * form surfaces the clinic's next available slots as reschedule alternatives
 * while retaining the user's unsaved form fields and selected pet. All
 * authorization and consent decisions remain owned by the backend; this
 * component only renders what the API returns.
 */

export interface AppointmentSlot {
  id: string;
  startTime: string;
  endTime: string;
  veterinarianName?: string;
}

export interface Pet {
  id: string;
  name: string;
}

export interface BookingFormValues {
  petId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  reason: string;
  notes: string;
  slotId: string;
}

export interface BookingFormProps {
  pets: Pet[];
  initialValues?: Partial<BookingFormValues>;
  /**
   * Submits the booking. The backend owns authorization/consent decisions and
   * returns either a confirmation or a slot-unavailable response with
   * alternative slots.
   */
  onSubmit: (values: BookingFormValues) => Promise<BookingSubmitResult>;
  /** Fetches the clinic's next available slots for rescheduling. */
  fetchAlternatives?: (clinicId: string) => Promise<AppointmentSlot[]>;
  clinicId?: string;
}

export type BookingSubmitResult =
  | { status: 'confirmed'; appointmentId: string }
  | { status: 'slot_unavailable'; alternatives?: AppointmentSlot[] }
  | { status: 'denied'; message?: string };

const EMPTY_VALUES: BookingFormValues = {
  petId: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  reason: '',
  notes: '',
  slotId: '',
};

function formatSlot(slot: AppointmentSlot): string {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${slot.startTime} – ${slot.endTime}`;
  }
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endTime = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date}, ${startTime} – ${endTime}`;
}

export default function BookingForm({
  pets,
  initialValues,
  onSubmit,
  fetchAlternatives,
  clinicId,
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<AppointmentSlot[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const alternativesHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === values.petId) ?? null,
    [pets, values.petId],
  );

  const updateField = useCallback(
    <K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const loadAlternatives = useCallback(async () => {
    if (!fetchAlternatives || !clinicId) return;
    setLoadingAlternatives(true);
    try {
      const slots = await fetchAlternatives(clinicId);
      setAlternatives(slots);
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlternatives(false);
    }
  }, [fetchAlternatives, clinicId]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      setConfirmation(null);
      try {
        const result = await onSubmit(values);
        if (result.status === 'confirmed') {
          setAlternatives([]);
          setConfirmation('Your appointment has been booked.');
        } else if (result.status === 'slot_unavailable') {
          // Retain all unsaved fields and the selected pet; only the slot
          // selection is cleared so the user can pick an alternative.
          setValues((prev) => ({ ...prev, slotId: '' }));
          if (result.alternatives && result.alternatives.length > 0) {
            setAlternatives(result.alternatives);
          } else {
            await loadAlternatives();
          }
        } else {
          setError(
            result.message ??
              'This booking could not be completed. Please contact the clinic.',
          );
        }
      } catch {
        setError('Something went wrong while booking. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, values, loadAlternatives],
  );

  const handleSelectAlternative = useCallback(
    (slot: AppointmentSlot) => {
      setValues((prev) => ({ ...prev, slotId: slot.id }));
      setAlternatives([]);
    },
    [],
  );

  // Move focus to the alternatives heading so screen-reader and keyboard users
  // are notified when the chosen slot becomes unavailable.
  useEffect(() => {
    if (alternatives.length > 0) {
      alternativesHeadingRef.current?.focus();
    }
  }, [alternatives]);

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
      <fieldset>
        <legend>Pet</legend>
        <label htmlFor="booking-pet">Selected pet</label>
        <select
          id="booking-pet"
          value={values.petId}
          onChange={(e) => updateField('petId', e.target.value)}
          required
        >
          <option value="">Select a pet</option>
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>
        {selectedPet ? (
          <p aria-live="polite">Booking for {selectedPet.name}</p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Your details</legend>
        <label htmlFor="booking-owner-name">Name</label>
        <input
          id="booking-owner-name"
          type="text"
          value={values.ownerName}
          onChange={(e) => updateField('ownerName', e.target.value)}
          autoComplete="name"
          required
        />
        <label htmlFor="booking-owner-email">Email</label>
        <input
          id="booking-owner-email"
          type="email"
          value={values.ownerEmail}
          onChange={(e) => updateField('ownerEmail', e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="booking-owner-phone">Phone</label>
        <input
          id="booking-owner-phone"
          type="tel"
          value={values.ownerPhone}
          onChange={(e) => updateField('ownerPhone', e.target.value)}
          autoComplete="tel"
        />
      </fieldset>

      <fieldset>
        <legend>Appointment</legend>
        <label htmlFor="booking-reason">Reason for visit</label>
        <input
          id="booking-reason"
          type="text"
          value={values.reason}
          onChange={(e) => updateField('reason', e.target.value)}
          required
        />
        <label htmlFor="booking-notes">Notes</label>
        <textarea
          id="booking-notes"
          value={values.notes}
          onChange={(e) => updateField('notes', e.target.value)}
        />
        <label htmlFor="booking-slot">Selected slot</label>
        <input
          id="booking-slot"
          type="text"
          value={values.slotId}
          onChange={(e) => updateField('slotId', e.target.value)}
          required
        />
      </fieldset>

      {error ? (
        <p role="alert">{error}</p>
      ) : null}
      {confirmation ? (
        <p role="status">{confirmation}</p>
      ) : null}

      {alternatives.length > 0 ? (
        <section aria-labelledby="reschedule-alternatives-heading">
          <h2
            id="reschedule-alternatives-heading"
            ref={alternativesHeadingRef}
            tabIndex={-1}
          >
            That slot is no longer available. Choose another time:
          </h2>
          <ul>
            {alternatives.map((slot) => (
              <li key={slot.id}>
                <button
                  type="button"
                  onClick={() => handleSelectAlternative(slot)}
                  aria-label={`Select ${formatSlot(slot)}${slot.veterinarianName ? ` with ${slot.veterinarianName}` : ''}`}
                >
                  {formatSlot(slot)}
                  {slot.veterinarianName ? ` — ${slot.veterinarianName}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadingAlternatives ? (
        <p role="status">Loading available times…</p>
      ) : null}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Booking…' : 'Book appointment'}
      </button>
    </form>
  );
}
