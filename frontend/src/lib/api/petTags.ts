import { apiClient } from './client';

export type PetTagStatus = 'active' | 'revoked';

export interface PetTag {
  id: string;
  petId: string;
  code: string;
  status: PetTagStatus;
  issuedAt: string;
  revokedAt: string | null;
  replacedByTagId: string | null;
  replacesTagId: string | null;
}

export interface PetTagInventory {
  petId: string;
  active: PetTag[];
  revoked: PetTag[];
}

export interface ReplacementIssuance {
  petId: string;
  reason?: string;
}

export interface ReplacementResult {
  revokedTag: PetTag;
  newTag: PetTag;
}

/**
 * Fetch the linked-tag inventory for a pet, including active and revoked tags.
 * Authorization and consent decisions are owned by the backend.
 */
export async function getPetTagInventory(petId: string): Promise<PetTagInventory> {
  const response = await apiClient.get<PetTagInventory>(`/pets/${encodeURIComponent(petId)}/tags`, {
    // Always bypass any browser/proxy cache so a revoked code cannot be
    // resurrected from a stale cached response.
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  return response.data;
}

/**
 * Issue a replacement QR tag for a pet. The backend revokes the previous tag
 * and returns both the revoked and newly issued tags.
 */
export async function issueReplacementTag(
  petId: string,
  payload: ReplacementIssuance = { petId },
): Promise<ReplacementResult> {
  const response = await apiClient.post<ReplacementResult>(
    `/pets/${encodeURIComponent(petId)}/tags/replace`,
    payload,
    { cache: 'no-store' },
  );
  return response.data;
}

/**
 * Resolve a scanned tag code. Returns null when the code is unknown or revoked
 * so callers never treat a revoked code as active.
 */
export async function resolveTagCode(code: string): Promise<PetTag | null> {
  const response = await apiClient.get<PetTag | null>(
    `/tags/${encodeURIComponent(code)}`,
    {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    },
  );
  const tag = response.data;
  if (!tag || tag.status !== 'active') {
    return null;
  }
  return tag;
}
