import { apiRequest } from './client';

export type EncounterSourceKind =
  | 'diagnosis'
  | 'treatment'
  | 'lab_result'
  | 'follow_up';

export interface EncounterSourceRef {
  kind: EncounterSourceKind;
  id: string;
  label: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface EncounterSummaryItem {
  id: string;
  kind: EncounterSourceKind;
  title: string;
  detail?: string;
  source: EncounterSourceRef;
}

export interface EncounterSummaryDraft {
  petId: string;
  encounterId?: string;
  items: EncounterSummaryItem[];
  followUpInstructions?: string;
}

export interface EncounterSummary {
  id: string;
  petId: string;
  encounterId?: string;
  items: EncounterSummaryItem[];
  followUpInstructions?: string;
  createdAt: string;
  createdBy?: string;
}

export interface EncounterSummaryResult {
  summary: EncounterSummary | null;
  denied: boolean;
  reason?: string;
}

interface EncounterSummaryResponse {
  summary?: EncounterSummary | null;
  denied?: boolean;
  reason?: string;
}

/**
 * Assemble linked diagnoses, treatments, lab results, and follow-up
 * instructions into a single encounter summary.
 *
 * Authorization and consent are decided by the backend; this client only
 * forwards the draft and surfaces the backend's decision (including denials).
 */
export async function composeEncounterSummary(
  draft: EncounterSummaryDraft,
): Promise<EncounterSummaryResult> {
  const response = await apiRequest<EncounterSummaryResponse>(
    '/encounters/summaries',
    {
      method: 'POST',
      body: JSON.stringify(draft),
    },
  );

  return {
    summary: response.summary ?? null,
    denied: response.denied === true,
    reason: response.reason,
  };
}

export async function getEncounterSummary(
  summaryId: string,
): Promise<EncounterSummaryResult> {
  const response = await apiRequest<EncounterSummaryResponse>(
    `/encounters/summaries/${encodeURIComponent(summaryId)}`,
    { method: 'GET' },
  );

  return {
    summary: response.summary ?? null,
    denied: response.denied === true,
    reason: response.reason,
  };
}
