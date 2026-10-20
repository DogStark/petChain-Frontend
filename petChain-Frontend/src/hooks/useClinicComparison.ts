import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ClinicComparisonService {
  id: string;
  name: string;
}

export interface ClinicComparisonOpeningHours {
  day: string;
  open: string | null;
  close: string | null;
}

export interface ClinicComparisonCredential {
  id: string;
  name: string;
  verified: boolean;
}

export interface ClinicComparisonRecord {
  id: string;
  name: string;
  distanceKm: number | null;
  services: ClinicComparisonService[];
  openingHours: ClinicComparisonOpeningHours[];
  credentials: ClinicComparisonCredential[];
}

export interface ClinicComparisonResponse {
  clinics: ClinicComparisonRecord[];
  /** ISO timestamp of when the backend produced this comparison data. */
  dataTimestamp: string;
}

export type ClinicComparisonStatus = 'idle' | 'loading' | 'success' | 'empty' | 'denied' | 'error';

export interface UseClinicComparisonOptions {
  /**
   * Fetches comparison data for the given clinic ids. Authorization and consent
   * decisions are owned by the backend; this hook only surfaces the outcome.
   */
  fetchComparison: (clinicIds: string[], signal?: AbortSignal) => Promise<ClinicComparisonResponse>;
  /** Maximum number of clinics that may be compared at once. */
  maxClinics?: number;
}

export interface UseClinicComparisonResult {
  status: ClinicComparisonStatus;
  clinics: ClinicComparisonRecord[];
  dataTimestamp: string | null;
  selectedIds: string[];
  error: string | null;
  isSelected: (clinicId: string) => boolean;
  canSelectMore: boolean;
  toggleClinic: (clinicId: string) => void;
  clearSelection: () => void;
  refresh: () => void;
}

const DEFAULT_MAX_CLINICS = 4;

export function useClinicComparison({
  fetchComparison,
  maxClinics = DEFAULT_MAX_CLINICS,
}: UseClinicComparisonOptions): UseClinicComparisonResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ClinicComparisonStatus>('idle');
  const [clinics, setClinics] = useState<ClinicComparisonRecord[]>([]);
  const [dataTimestamp, setDataTimestamp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const isSelected = useCallback(
    (clinicId: string) => selectedIds.includes(clinicId),
    [selectedIds],
  );

  const canSelectMore = selectedIds.length < maxClinics;

  const toggleClinic = useCallback(
    (clinicId: string) => {
      setSelectedIds((current) => {
        if (current.includes(clinicId)) {
          return current.filter((id) => id !== clinicId);
        }
        if (current.length >= maxClinics) {
          return current;
        }
        return [...current, clinicId];
      });
    },
    [maxClinics],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStatus('idle');
      setClinics([]);
      setDataTimestamp(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    let active = true;
    setStatus('loading');
    setError(null);

    fetchComparison(selectedIds, controller.signal)
      .then((response) => {
        if (!active) {
          return;
        }
        setClinics(response.clinics);
        setDataTimestamp(response.dataTimestamp);
        setStatus(response.clinics.length === 0 ? 'empty' : 'success');
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to load clinic comparison.';
        const denied =
          typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status?: number }).status === 403;
        setClinics([]);
        setDataTimestamp(null);
        setError(message);
        setStatus(denied ? 'denied' : 'error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchComparison, selectedIds, reloadToken]);

  return useMemo(
    () => ({
      status,
      clinics,
      dataTimestamp,
      selectedIds,
      error,
      isSelected,
      canSelectMore,
      toggleClinic,
      clearSelection,
      refresh,
    }),
    [
      status,
      clinics,
      dataTimestamp,
      selectedIds,
      error,
      isSelected,
      canSelectMore,
      toggleClinic,
      clearSelection,
      refresh,
    ],
  );
}
