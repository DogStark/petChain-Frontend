import { apiClient } from './client';

export interface ClinicOpeningHours {
  day: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface ClinicCredential {
  id: string;
  name: string;
  verified: boolean;
  verifiedAt?: string | null;
}

export interface Clinic {
  id: string;
  name: string;
  address?: string;
  distanceKm?: number | null;
  services?: string[];
  openingHours?: ClinicOpeningHours[];
  credentials?: ClinicCredential[];
  updatedAt?: string | null;
}

export interface ClinicComparison {
  clinics: Clinic[];
  /** ISO timestamp of when the backend produced this comparison data. */
  dataTimestamp: string | null;
}

/**
 * Fetch comparison data for the selected clinics.
 *
 * Authorization and consent decisions are owned by the backend; this client
 * only forwards the requested clinic ids and surfaces the backend response
 * (including denied/empty states) to the caller.
 */
export async function compareClinics(clinicIds: string[]): Promise<ClinicComparison> {
  const params = new URLSearchParams();
  for (const id of clinicIds) {
    params.append('clinicIds', id);
  }

  const response = await apiClient.get<ClinicComparison>(
    `/clinics/compare?${params.toString()}`
  );

  return {
    clinics: response.data.clinics ?? [],
    dataTimestamp: response.data.dataTimestamp ?? null,
  };
}
