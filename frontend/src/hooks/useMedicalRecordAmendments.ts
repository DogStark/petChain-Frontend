import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type AmendmentFieldValue = string | number | boolean | null | undefined;

export interface MedicalRecordField {
  key: string;
  label: string;
  value: AmendmentFieldValue;
}

export interface MedicalRecordAmendment {
  id: string;
  recordId: string;
  author: string;
  createdAt: string;
  reason?: string;
  original: MedicalRecordField[];
  corrected: MedicalRecordField[];
}

export interface AmendmentFieldDiff {
  key: string;
  label: string;
  original: AmendmentFieldValue;
  corrected: AmendmentFieldValue;
  changed: boolean;
}

export interface AmendmentDiff {
  amendment: MedicalRecordAmendment;
  fields: AmendmentFieldDiff[];
  changedCount: number;
}

export type AmendmentStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'denied' | 'error';

export interface UseMedicalRecordAmendmentsResult {
  status: AmendmentStatus;
  amendments: MedicalRecordAmendment[];
  diffs: AmendmentDiff[];
  error: string | null;
  reload: () => void;
}

function normalizeValue(value: AmendmentFieldValue): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function valuesEqual(a: AmendmentFieldValue, b: AmendmentFieldValue): boolean {
  return normalizeValue(a) === normalizeValue(b);
}

/**
 * Builds a field-by-field diff between the original and corrected record.
 * Fields present in either version are included so additions and removals
 * are surfaced as changes rather than silently dropped.
 */
export function buildAmendmentDiff(amendment: MedicalRecordAmendment): AmendmentDiff {
  const originalByKey = new Map(amendment.original.map((field) => [field.key, field]));
  const correctedByKey = new Map(amendment.corrected.map((field) => [field.key, field]));
  const keys: string[] = [];

  for (const field of amendment.original) {
    if (!keys.includes(field.key)) keys.push(field.key);
  }
  for (const field of amendment.corrected) {
    if (!keys.includes(field.key)) keys.push(field.key);
  }

  const fields: AmendmentFieldDiff[] = keys.map((key) => {
    const originalField = originalByKey.get(key);
    const correctedField = correctedByKey.get(key);
    const original = originalField?.value;
    const corrected = correctedField?.value;
    return {
      key,
      label: correctedField?.label ?? originalField?.label ?? key,
      original,
      corrected,
      changed: !valuesEqual(original, corrected),
    };
  });

  return {
    amendment,
    fields,
    changedCount: fields.filter((field) => field.changed).length,
  };
}

interface FetchState {
  status: AmendmentStatus;
  amendments: MedicalRecordAmendment[];
  error: string | null;
}

const INITIAL_STATE: FetchState = { status: 'idle', amendments: [], error: null };

/**
 * Loads amendment history for a medical record and derives side-by-side diffs.
 * Authorization and consent are enforced by the backend; a 401/403 response is
 * surfaced as a `denied` state so the UI can render a privacy-preserving notice.
 */
export function useMedicalRecordAmendments(
  recordId: string | null | undefined,
): UseMedicalRecordAmendmentsResult {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!recordId) {
      setState(INITIAL_STATE);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading', amendments: [], error: null });

    const load = async () => {
      try {
        const response = await fetch(
          `/api/medical-records/${encodeURIComponent(recordId)}/amendments`,
          {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          },
        );

        if (response.status === 401 || response.status === 403) {
          setState({ status: 'denied', amendments: [], error: null });
          return;
        }

        if (!response.ok) {
          setState({
            status: 'error',
            amendments: [],
            error: `Unable to load amendment history (${response.status}).`,
          });
          return;
        }

        const payload = (await response.json()) as { amendments?: MedicalRecordAmendment[] };
        const amendments = Array.isArray(payload.amendments) ? payload.amendments : [];
        setState({
          status: amendments.length === 0 ? 'empty' : 'ready',
          amendments,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          amendments: [],
          error: err instanceof Error ? err.message : 'Unable to load amendment history.',
        });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [recordId, reloadToken]);

  const diffs = useMemo(
    () => state.amendments.map((amendment) => buildAmendmentDiff(amendment)),
    [state.amendments],
  );

  return {
    status: state.status,
    amendments: state.amendments,
    diffs,
    error: state.error,
    reload,
  };
}
