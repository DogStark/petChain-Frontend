import { apiRequest } from "./client";

export type ProfileFieldSource = "owner" | "vet" | "chain";

export type ProfileFieldStatus = "complete" | "missing" | "pending";

export interface ProfileFieldReview {
  key: string;
  label: string;
  source: ProfileFieldSource;
  status: ProfileFieldStatus;
  /** True only when the backend has confirmed the field may be shown to the viewer. */
  attested: boolean;
  /** Backend-owned consent decision; frontend must not infer or override this. */
  consented: boolean;
  /** Optional backend-provided guidance on how to improve coverage. */
  guidance?: string;
}

export interface ProfileCompletenessReview {
  overallPercent: number;
  bySource: Record<ProfileFieldSource, { complete: number; total: number }>;
  fields: ProfileFieldReview[];
}

/**
 * Fetch the profile completeness review grouped by data source.
 *
 * Authorization and consent are decided by the backend: this client only
 * forwards the request and returns whatever the backend has deemed safe to
 * expose. Fields the backend omits (or marks unconsented) are never surfaced.
 */
export async function getProfileCompletenessReview(
  profileId: string,
  signal?: AbortSignal,
): Promise<ProfileCompletenessReview> {
  const response = await apiRequest<ProfileCompletenessReview>(
    `/profiles/${encodeURIComponent(profileId)}/completeness`,
    { method: "GET", signal },
  );

  return sanitizeReview(response);
}

/**
 * Defensive privacy filter: drop any field the backend did not explicitly
 * attest and consent to, so non-consented data can never leak into the UI.
 */
export function sanitizeReview(
  review: ProfileCompletenessReview,
): ProfileCompletenessReview {
  const fields = (review.fields ?? []).filter(
    (field) => field.attested && field.consented,
  );

  return {
    overallPercent: review.overallPercent ?? 0,
    bySource: review.bySource ?? {
      owner: { complete: 0, total: 0 },
      vet: { complete: 0, total: 0 },
      chain: { complete: 0, total: 0 },
    },
    fields,
  };
}
