import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PetProfileHistoryActor = {
  id: string;
  name: string;
  role?: string;
};

export type PetProfileHistoryEntry = {
  id: string;
  field: string;
  previousValue?: string | null;
  newValue?: string | null;
  actor: PetProfileHistoryActor;
  timestamp: string;
  source?: 'manual' | 'import' | 'system';
  isSecret?: boolean;
  correctionRequested?: boolean;
};

export type PetProfileHistoryState = {
  entries: PetProfileHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  denied: boolean;
};

export type CorrectionRequestInput = {
  entryId: string;
  reason: string;
};

export type UsePetProfileHistoryOptions = {
  petId: string;
  fetcher?: (petId: string, signal: AbortSignal) => Promise<PetProfileHistoryEntry[]>;
  correctionRequester?: (petId: string, input: CorrectionRequestInput) => Promise<void>;
};

const SECRET_PLACEHOLDER = '••••••';

function redactValue(entry: PetProfileHistoryEntry, value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (entry.isSecret) {
    return SECRET_PLACEHOLDER;
  }
  return value;
}

export function redactHistoryEntry(entry: PetProfileHistoryEntry): PetProfileHistoryEntry {
  return {
    ...entry,
    previousValue: redactValue(entry, entry.previousValue),
    newValue: redactValue(entry, entry.newValue),
  };
}

async function defaultFetcher(petId: string, signal: AbortSignal): Promise<PetProfileHistoryEntry[]> {
  const response = await fetch(`/api/pets/${encodeURIComponent(petId)}/profile/history`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    const deniedError = new Error('denied');
    (deniedError as Error & { denied?: boolean }).denied = true;
    throw deniedError;
  }

  if (!response.ok) {
    throw new Error(`Failed to load profile history (${response.status})`);
  }

  const payload = (await response.json()) as { entries?: PetProfileHistoryEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}

async function defaultCorrectionRequester(petId: string, input: CorrectionRequestInput): Promise<void> {
  const response = await fetch(
    `/api/pets/${encodeURIComponent(petId)}/profile/history/${encodeURIComponent(input.entryId)}/correction-request`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ reason: input.reason }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to submit correction request (${response.status})`);
  }
}

export function usePetProfileHistory({
  petId,
  fetcher = defaultFetcher,
  correctionRequester = defaultCorrectionRequester,
}: UsePetProfileHistoryOptions) {
  const [state, setState] = useState<PetProfileHistoryState>({
    entries: [],
    isLoading: Boolean(petId),
    error: null,
    denied: false,
  });
  const [pendingCorrections, setPendingCorrections] = useState<Record<string, boolean>>({});
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!petId) {
      setState({ entries: [], isLoading: false, error: null, denied: false });
      return;
    }

    const controller = new AbortController();
    setState({ entries: [], isLoading: true, error: null, denied: false });

    fetcher(petId, controller.signal)
      .then((entries) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        setState({
          entries: entries.map(redactHistoryEntry),
          isLoading: false,
          error: null,
          denied: false,
        });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        const denied = Boolean((error as { denied?: boolean } | null)?.denied);
        setState({
          entries: [],
          isLoading: false,
          error: denied ? null : error instanceof Error ? error.message : 'Failed to load profile history',
          denied,
        });
      });

    return () => {
      controller.abort();
    };
  }, [petId, fetcher]);

  const requestCorrection = useCallback(
    async (input: CorrectionRequestInput) => {
      setCorrectionError(null);
      setPendingCorrections((prev) => ({ ...prev, [input.entryId]: true }));
      try {
        await correctionRequester(petId, input);
        if (!mountedRef.current) {
          return;
        }
        setState((prev) => ({
          ...prev,
          entries: prev.entries.map((entry) =>
            entry.id === input.entryId ? { ...entry, correctionRequested: true } : entry,
          ),
        }));
      } catch (error: unknown) {
        if (mountedRef.current) {
          setCorrectionError(
            error instanceof Error ? error.message : 'Failed to submit correction request',
          );
        }
      } finally {
        if (mountedRef.current) {
          setPendingCorrections((prev) => {
            const next = { ...prev };
            delete next[input.entryId];
            return next;
          });
        }
      }
    },
    [petId, correctionRequester],
  );

  const canRequestCorrection = useCallback(
    (entry: PetProfileHistoryEntry) => entry.source === 'import' && !entry.correctionRequested,
    [],
  );

  return useMemo(
    () => ({
      ...state,
      isEmpty: !state.isLoading && !state.denied && !state.error && state.entries.length === 0,
      pendingCorrections,
      correctionError,
      canRequestCorrection,
      requestCorrection,
    }),
    [state, pendingCorrections, correctionError, canRequestCorrection, requestCorrection],
  );
}
