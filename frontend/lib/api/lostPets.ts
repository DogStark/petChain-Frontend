import { apiClient } from './client';

export type LostPetStatus = 'active' | 'recovered' | 'closed';

export interface LostPetPublicDetails {
  petId: string;
  name: string;
  species: string;
  breed?: string;
  color?: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  contactInstructions?: string;
  photoUrl?: string;
}

export interface LostPetReport {
  id: string;
  petId: string;
  status: LostPetStatus;
  publicDetails: LostPetPublicDetails;
  createdAt: string;
  recoveredAt?: string;
}

export interface CreateLostPetReportInput {
  petId: string;
  publicDetails: LostPetPublicDetails;
}

/**
 * Fetch the public details that would be shown for a lost-pet alert.
 * The backend owns consent/authorization decisions; this only surfaces
 * what the owner is allowed to review.
 */
export async function getLostPetPublicDetails(
  petId: string,
): Promise<LostPetPublicDetails> {
  const { data } = await apiClient.get<LostPetPublicDetails>(
    `/pets/${encodeURIComponent(petId)}/lost-report/public-details`,
  );
  return data;
}

/**
 * Mark a pet as missing, creating an active lost-pet report.
 */
export async function createLostPetReport(
  input: CreateLostPetReportInput,
): Promise<LostPetReport> {
  const { data } = await apiClient.post<LostPetReport>(
    `/pets/${encodeURIComponent(input.petId)}/lost-report`,
    { publicDetails: input.publicDetails },
  );
  return data;
}

/**
 * Fetch the current lost-pet report for a pet, if any.
 */
export async function getLostPetReport(
  petId: string,
): Promise<LostPetReport | null> {
  const { data } = await apiClient.get<LostPetReport | null>(
    `/pets/${encodeURIComponent(petId)}/lost-report`,
  );
  return data;
}

/**
 * Close an active lost-pet alert after the pet has been recovered.
 */
export async function closeLostPetReport(
  petId: string,
): Promise<LostPetReport> {
  const { data } = await apiClient.post<LostPetReport>(
    `/pets/${encodeURIComponent(petId)}/lost-report/close`,
  );
  return data;
}
