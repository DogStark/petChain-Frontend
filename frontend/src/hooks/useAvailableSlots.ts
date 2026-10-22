import { useCallback, useEffect, useRef, useState } from 'react';

export interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  veterinarianId?: string;
  veterinarianName?: string;
  available: boolean;
}

export interface SlotAvailabilityResponse {
  slots: AvailableSlot[];
  /** Backend-owned decision: whether the caller may view/act on these slots. */
  authorized?: boolean;
  /** Backend-owned consent requirement for booking/rescheduling. */
  consentRequired?: boolean;
}

export interface UseAvailableSlotsOptions {
  clinicId?: string;
  petId?: string;
  /** ISO date (YYYY-MM-DD) to fetch alternatives for. */
  date?: string;
  /** Slot currently selected by the user; used to detect unavailability. */
  selectedSlotId?: string;
  /** Optional fetcher override (defaults to the internal client call). */
  fetcher?: (params: {
    clinicId?: string;
    petId?: string;
    date?: string;
    signal?: AbortSignal;
  }) => Promise<SlotAvailabilityResponse>;
}

export interface UseAvailableSlotsResult {
  slots: AvailableSlot[];
  alternatives: AvailableSlot[];
  loading: boolean;
  error: string | null;
  /** True when the backend denied access (401/403) or returned authorized: false. */
  denied: boolean;
  /** True when the backend requires consent before proceeding. */
  consentRequired: boolean;
  /** True when the currently selected slot is no longer available. */
  selectedSlotUnavailable: boolean;
  refresh: () => void;
}

async function defaultFetcher({
  clinicId,
  petId,
  date,
  signal,
}: {
  clinicId?: string;
  petId?: string;
  date?: string;
  signal?: AbortSignal;
}): Promise<SlotAvailabilityResponse> {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinicId', clinicId);
  if (petId) params.set('petId', petId);
  if (date) params.set('date', date);

  const response = await fetch(`/api/appointments/available-slots?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    return { slots: [], authorized: false };
  }

  if (!response.ok) {
    throw new Error(`Failed to load available slots (${response.status})`);
  }

  return (await response.json()) as SlotAvailabilityResponse;
}

/**
 * Loads a clinic's available slots and derives reschedule alternatives when the
 * user's currently selected slot becomes unavailable. Authorization and consent
 * decisions are surfaced from the backend response and never decided here.
 */
export function useAvailableSlots({
  clinicId,
  petId,
  date,
  selectedSlotId,
  fetcher = defaultFetcher,
}: UseAvailableSlotsOptions = {}): UseAvailableSlotsResult {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState<boolean>(false);
  const [consentRequired, setConsentRequired] = useState<boolean>(false);
  const [reloadToken, setReloadToken] = useState<number>(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!clinicId) {
      setSlots([]);
      setLoading(false);
      setError(null);
      setDenied(false);
      setConsentRequired(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    fetcherRef
      .current({ clinicId, petId, date, signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setSlots(Array.isArray(result.slots) ? result.slots : []);
        setDenied(result.authorized === false);
        setConsentRequired(Boolean(result.consentRequired));
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setSlots([]);
        setError(err instanceof Error ? err.message : 'Unable to load available slots');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clinicId, petId, date, reloadToken]);

  const selectedSlot = selectedSlotId
    ? slots.find((slot) => slot.id === selectedSlotId)
    : undefined;
  const selectedSlotUnavailable = Boolean(selectedSlotId) && !loading && !selectedSlot?.available;

  const alternatives = selectedSlotUnavailable
    ? slots.filter((slot) => slot.available && slot.id !== selectedSlotId)
    : [];

  return {
    slots,
    alternatives,
    loading,
    error,
    denied,
    consentRequired,
    selectedSlotUnavailable,
    refresh,
  };
}

export default useAvailableSlots;
