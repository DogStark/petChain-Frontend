import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Profile completeness review by data source.
 *
 * The backend owns authorization and consent decisions. This hook only
 * consumes backend-provided attestation/consent data and groups fields by
 * their source so the UI can show what is attested and how to improve
 * coverage. Fields the backend has not marked as consented are never
 * surfaced, preserving privacy by default.
 */

export type ProfileFieldSource = 'owner' | 'vet' | 'chain';

export interface ProfileFieldAttestation {
  /** Stable field identifier, e.g. "pet.name". */
  key: string;
  /** Human-readable label for the field. */
  label: string;
  /** Where the value originates. */
  source: ProfileFieldSource;
  /** Whether the field currently has a value. */
  present: boolean;
  /** Backend attestation state for this field. */
  attested: boolean;
  /** Backend consent decision; only consented fields are rendered. */
  consented: boolean;
  /** Optional guidance on how to improve coverage for this field. */
  guidance?: string;
}

export interface ProfileCompletenessResponse {
  fields: ProfileFieldAttestation[];
}

export interface ProfileCompletenessGroup {
  source: ProfileFieldSource;
  label: string;
  fields: ProfileFieldAttestation[];
  presentCount: number;
  attestedCount: number;
  totalCount: number;
  /** Percentage (0-100) of consented fields that are present. */
  completeness: number;
}

export interface ProfileCompletenessReview {
  groups: ProfileCompletenessGroup[];
  /** Consented fields that are missing or unattested, with guidance. */
  improvements: ProfileFieldAttestation[];
  /** Overall percentage (0-100) across consented fields. */
  overallCompleteness: number;
}

export type ProfileCompletenessFetcher = (
  signal?: AbortSignal,
) => Promise<ProfileCompletenessResponse>;

export interface UseProfileCompletenessResult {
  review: ProfileCompletenessReview | null;
  loading: boolean;
  error: Error | null;
  /** True when the backend denied access or returned no consented fields. */
  denied: boolean;
  refetch: () => void;
}

const SOURCE_ORDER: ProfileFieldSource[] = ['owner', 'vet', 'chain'];

const SOURCE_LABELS: Record<ProfileFieldSource, string> = {
  owner: 'Owner-entered',
  vet: 'Vet-verified',
  chain: 'Chain-anchored',
};

const DEFAULT_GUIDANCE: Record<ProfileFieldSource, string> = {
  owner: 'Add this detail to your pet profile.',
  vet: 'Ask your veterinarian to verify this detail.',
  chain: 'Anchor this detail on-chain to strengthen its attestation.',
};

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Builds the grouped review from a backend response. Only consented fields
 * are included so non-consented data is never exposed to the UI.
 */
export function buildProfileCompletenessReview(
  response: ProfileCompletenessResponse | null,
): ProfileCompletenessReview | null {
  if (!response || !Array.isArray(response.fields)) return null;

  const consented = response.fields.filter((field) => field.consented);

  const groups: ProfileCompletenessGroup[] = SOURCE_ORDER.map((source) => {
    const fields = consented.filter((field) => field.source === source);
    const presentCount = fields.filter((field) => field.present).length;
    const attestedCount = fields.filter((field) => field.attested).length;
    return {
      source,
      label: SOURCE_LABELS[source],
      fields,
      presentCount,
      attestedCount,
      totalCount: fields.length,
      completeness: percentage(presentCount, fields.length),
    };
  }).filter((group) => group.totalCount > 0);

  const improvements = consented
    .filter((field) => !field.present || !field.attested)
    .map((field) => ({
      ...field,
      guidance: field.guidance ?? DEFAULT_GUIDANCE[field.source],
    }));

  const presentTotal = consented.filter((field) => field.present).length;

  return {
    groups,
    improvements,
    overallCompleteness: percentage(presentTotal, consented.length),
  };
}

export function useProfileCompleteness(
  fetcher: ProfileCompletenessFetcher,
): UseProfileCompletenessResult {
  const [response, setResponse] = useState<ProfileCompletenessResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [denied, setDenied] = useState<boolean>(false);
  const [reloadToken, setReloadToken] = useState<number>(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setDenied(false);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        setResponse(result);
        const hasConsented =
          Array.isArray(result?.fields) &&
          result.fields.some((field) => field.consented);
        setDenied(!hasConsented);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        const normalized =
          err instanceof Error ? err : new Error('Failed to load profile review');
        setError(normalized);
        setResponse(null);
        setDenied(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const review = useMemo(
    () => buildProfileCompletenessReview(response),
    [response],
  );

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { review, loading, error, denied, refetch };
}
