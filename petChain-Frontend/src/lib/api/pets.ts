import { apiClient } from './client';
import type { Pet, PetProfileChange, PetProfileChangeHistory } from '../types/pet';

export interface PetProfileChangeHistoryParams {
  petId: string;
  cursor?: string;
  limit?: number;
}

export interface PetProfileCorrectionRequest {
  petId: string;
  changeId: string;
  reason: string;
  requestedValue?: string;
}

/**
 * Fetch the owner-authorized change history for a pet profile.
 * Authorization and consent are enforced by the backend; the client only
 * forwards the request and renders what the backend returns.
 */
export async function getPetProfileChangeHistory(
  params: PetProfileChangeHistoryParams,
): Promise<PetProfileChangeHistory> {
  const { petId, cursor, limit } = params;
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (typeof limit === 'number') query.set('limit', String(limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiClient.get<PetProfileChangeHistory>(
    `/pets/${encodeURIComponent(petId)}/profile/history${suffix}`,
  );
}

/**
 * Request a correction for an imported profile change. The backend decides
 * whether the requesting user is allowed to submit the correction.
 */
export async function requestPetProfileChangeCorrection(
  params: PetProfileCorrectionRequest,
): Promise<PetProfileChange> {
  const { petId, changeId, reason, requestedValue } = params;
  return apiClient.post<PetProfileChange>(
    `/pets/${encodeURIComponent(petId)}/profile/history/${encodeURIComponent(
      changeId,
    )}/correction`,
    { reason, requestedValue },
  );
}

export async function getPet(petId: string): Promise<Pet> {
  return apiClient.get<Pet>(`/pets/${encodeURIComponent(petId)}`);
}
