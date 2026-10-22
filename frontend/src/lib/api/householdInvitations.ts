import { apiClient } from './client';

export type HouseholdInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

/**
 * Invitation as returned by the backend for listing/management.
 * The raw invitation secret is intentionally absent: it is only ever
 * surfaced once, at creation time (see {@link CreatedHouseholdInvitation}).
 */
export interface HouseholdInvitation {
  id: string;
  householdId: string;
  email: string;
  role: string;
  status: HouseholdInvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

/**
 * Creation response. `secret` is the one-time raw invitation secret and is
 * never returned again by any subsequent endpoint.
 */
export interface CreatedHouseholdInvitation extends HouseholdInvitation {
  secret: string;
}

export interface CreateHouseholdInvitationInput {
  email: string;
  role: string;
}

export interface ListHouseholdInvitationsParams {
  status?: HouseholdInvitationStatus;
}

function householdInvitationsPath(householdId: string): string {
  return `/households/${encodeURIComponent(householdId)}/invitations`;
}

/**
 * List invitations for a household. Authorization and consent decisions are
 * owned by the backend; this client only forwards the request.
 */
export async function listHouseholdInvitations(
  householdId: string,
  params: ListHouseholdInvitationsParams = {},
): Promise<HouseholdInvitation[]> {
  const query = params.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiClient.get<HouseholdInvitation[]>(
    `${householdInvitationsPath(householdId)}${query}`,
  );
}

/**
 * Create an invitation. The returned `secret` must be shown to the user once
 * and never persisted or re-fetched.
 */
export async function createHouseholdInvitation(
  householdId: string,
  input: CreateHouseholdInvitationInput,
): Promise<CreatedHouseholdInvitation> {
  return apiClient.post<CreatedHouseholdInvitation>(
    householdInvitationsPath(householdId),
    input,
  );
}

/**
 * Resend an invitation. The backend decides whether resending is permitted
 * (e.g. pending or expired invitations) and returns the updated record.
 * No raw secret is returned here.
 */
export async function resendHouseholdInvitation(
  householdId: string,
  invitationId: string,
): Promise<HouseholdInvitation> {
  return apiClient.post<HouseholdInvitation>(
    `${householdInvitationsPath(householdId)}/${encodeURIComponent(invitationId)}/resend`,
  );
}

/**
 * Revoke an invitation. Eligibility (pending only) is enforced by the backend.
 */
export async function revokeHouseholdInvitation(
  householdId: string,
  invitationId: string,
): Promise<HouseholdInvitation> {
  return apiClient.post<HouseholdInvitation>(
    `${householdInvitationsPath(householdId)}/${encodeURIComponent(invitationId)}/revoke`,
  );
}

/**
 * Whether an invitation can be resent from the UI. This is a presentation
 * hint only; the backend remains the source of truth for authorization.
 */
export function canResendInvitation(invitation: HouseholdInvitation): boolean {
  return invitation.status === 'pending' || invitation.status === 'expired';
}

/**
 * Whether an invitation can be revoked from the UI. Presentation hint only.
 */
export function canRevokeInvitation(invitation: HouseholdInvitation): boolean {
  return invitation.status === 'pending';
}
