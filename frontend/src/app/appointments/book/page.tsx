'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Pet {
  id: string;
  name: string;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  veterinarianName?: string;
}

interface BookingFormState {
  petId: string;
  reason: string;
  notes: string;
  ownerPhone: string;
}

const EMPTY_FORM: BookingFormState = {
  petId: '',
  reason: '',
  notes: '',
  ownerPhone: '',
};

function formatSlot(slot: Slot): string {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = `${start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })} \u2013 ${end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
  return `${dateLabel}, ${timeLabel}`;
}

export default function BookAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clinicId = searchParams.get('clinicId') ?? '';

  const [pets, setPets] = useState<Pet[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [alternatives, setAlternatives] = useState<Slot[]>([]);
  const [unavailableMessage, setUnavailableMessage] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function loadPets() {
      try {
        const res = await fetch('/api/pets', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { pets?: Pet[] };
        if (!cancelled) setPets(data.pets ?? []);
      } catch {
        // Pet list is non-critical; the form still works without it.
      }
    }
    loadPets();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSlots = useCallback(async () => {
    if (!clinicId) return;
    setLoadingSlots(true);
    setError('');
    try {
      const res = await fetch(
        `/api/clinics/${encodeURIComponent(clinicId)}/available-slots`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        setSlots([]);
        return;
      }
      const data = (await res.json()) as { slots?: Slot[] };
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === form.petId) ?? null,
    [pets, form.petId],
  );

  const handleFieldChange = (
    field: keyof BookingFormState,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectSlot = (slotId: string) => {
    setSelectedSlotId(slotId);
    setAlternatives([]);
    setUnavailableMessage('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlotId) {
      setError('Please choose an appointment slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    setUnavailableMessage('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          slotId: selectedSlotId,
          petId: form.petId,
          reason: form.reason,
          notes: form.notes,
          ownerPhone: form.ownerPhone,
        }),
      });

      if (res.status === 409) {
        // Slot became unavailable. Keep the form state intact and offer
        // the clinic's next available slots as alternatives.
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          alternatives?: Slot[];
        };
        setSelectedSlotId('');
        setUnavailableMessage(
          data.message ??
            'That slot is no longer available. Please choose one of the alternatives below.',
        );
        if (Array.isArray(data.alternatives) && data.alternatives.length > 0) {
          setAlternatives(data.alternatives);
        } else {
          await loadSlots();
        }
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data.message ?? 'Unable to book this appointment.');
        return;
      }

      router.push('/appointments');
    } catch {
      setError('Unable to book this appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const alternativeSlots = alternatives.length > 0 ? alternatives : slots;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Book an appointment</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label htmlFor="pet" className="block text-sm font-medium">
            Pet
          </label>
          <select
            id="pet"
            value={form.petId}
            onChange={(e) => handleFieldChange('petId', e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            required
          >
            <option value="">Select a pet</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium">
            Reason for visit
          </label>
          <input
            id="reason"
            type="text"
            value={form.reason}
            onChange={(e) => handleFieldChange('reason', e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="ownerPhone" className="block text-sm font-medium">
            Contact phone
          </label>
          <input
            id="ownerPhone"
            type="tel"
            value={form.ownerPhone}
            onChange={(e) => handleFieldChange('ownerPhone', e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            rows={3}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Appointment slot</legend>

          {unavailableMessage ? (
            <p
              role="alert"
              aria-live="assertive"
              className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {unavailableMessage}
            </p>
          ) : null}

          {loadingSlots ? (
            <p className="mt-2 text-sm text-gray-600" role="status">
              Loading available slots\u2026
            </p>
          ) : alternativeSlots.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600" role="status">
              No available slots right now. Please check back later.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {alternativeSlots.map((slot) => (
                <li key={slot.id}>
                  <label className="flex items-center gap-2 rounded border px-3 py-2">
                    <input
                      type="radio"
                      name="slot"
                      value={slot.id}
                      checked={selectedSlotId === slot.id}
                      onChange={() => handleSelectSlot(slot.id)}
                    />
                    <span>
                      {formatSlot(slot)}
                      {slot.veterinarianName ? (
                        <span className="text-gray-600">
                          {' '}
                          \u00b7 {slot.veterinarianName}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {selectedPet ? (
          <p className="text-sm text-gray-600">
            Booking for <strong>{selectedPet.name}</strong>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !selectedSlotId}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Booking\u2026' : 'Book appointment'}
        </button>
      </form>
    </main>
  );
}
