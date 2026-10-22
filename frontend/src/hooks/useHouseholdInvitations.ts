import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type HouseholdInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

/**
 * Invitation as returned by the backend. The raw invitation secret is never
 * included here — it is only surfaced once, at creation time, via
 * `CreatedHouseholdInvitation`.
 */
export interface HouseholdInvitation {
  id: string;
  email: string;
  role: string;
  status: HouseholdInvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

/**
 * The one-time creation response. `secret` is the raw invitation token and is
 * intentionally kept out of `HouseholdInvitation` so it can never be re-read
 * from the list endpoint.
 */
export interface CreatedHouseholdInvitation {
  invitation: HouseholdInvitation;
  secret: string;
}

export interface CreateInvitationInput {
  email: string;
  role: string;
}

export interface HouseholdInvitationsClient {
  list(householdId: string): Promise<HouseholdInvitation[]>;
  create(
    householdId: string,
    input: CreateInvitationInput,
  ): Promise<CreatedHouseholdInvitation>;
  resend(householdId: string, invitationId: string): Promise<HouseholdInvitation>;
  revoke(householdId: string, invitationId: string): Promise<HouseholdInvitation>;
}

export interface UseHouseholdInvitationsResult {
  invitations: HouseholdInvitation[];
  pending: HouseholdInvitation[];
  accepted: HouseholdInvitation[];
  expired: HouseholdInvitation[];
  revoked: HouseholdInvitation[];
  /** Raw secret from the most recent creation; cleared once acknowledged. */
  createdSecret: string | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  /** True when the backend denied access (e.g. 401/403). */
  isDenied: boolean;
  refresh: () => Promise<void>;
  createInvitation: (input: CreateInvitationInput) => Promise<CreatedHouseholdInvitation | null>;
  resendInvitation: (invitationId: string) => Promise<boolean>;
  revokeInvitation: (invitationId: string) => Promise<boolean>;
  dismissCreatedSecret: () => void;
}

function isDeniedError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (status === 401 || status === 403) {
      return true;
    }
  }
  return false;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Manages household member invitations. Authorization and consent decisions
 * (who may invite, resend, or revoke) are owned by the backend; this hook only
 * reflects the resulting state and surfaces denied responses.
 */
export function useHouseholdInvitations(
  householdId: string | null | undefined,
  client: HouseholdInvitationsClient,
): UseHouseholdInvitationsResult {
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(householdId));
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!householdId) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsDenied(false);
    try {
      const result = await client.list(householdId);
      if (!mountedRef.current) return;
      setInvitations(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setIsDenied(isDeniedError(err));
      setError(toMessage(err));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, householdId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createInvitation = useCallback(
    async (input: CreateInvitationInput): Promise<CreatedHouseholdInvitation | null> => {
      if (!householdId) return null;
      setIsMutating(true);
      setError(null);
      try {
        const created = await client.create(householdId, input);
        if (!mountedRef.current) return null;
        setInvitations((prev) => [created.invitation, ...prev]);
        setCreatedSecret(created.secret);
        return created;
      } catch (err) {
        if (mountedRef.current) {
          setIsDenied(isDeniedError(err));
          setError(toMessage(err));
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [client, householdId],
  );

  const replaceInvitation = useCallback((updated: HouseholdInvitation) => {
    setInvitations((prev) =>
      prev.map((invitation) => (invitation.id === updated.id ? updated : invitation)),
    );
  }, []);

  const resendInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      if (!householdId) return false;
      setIsMutating(true);
      setError(null);
      try {
        const updated = await client.resend(householdId, invitationId);
        if (!mountedRef.current) return false;
        replaceInvitation(updated);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setIsDenied(isDeniedError(err));
          setError(toMessage(err));
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [client, householdId, replaceInvitation],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      if (!householdId) return false;
      setIsMutating(true);
      setError(null);
      try {
        const updated = await client.revoke(householdId, invitationId);
        if (!mountedRef.current) return false;
        replaceInvitation(updated);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setIsDenied(isDeniedError(err));
          setError(toMessage(err));
        }
        return false;
      } finally {
        if (mountedRef.current) {
          setIsMutating(false);
        }
      }
    },
    [client, householdId, replaceInvitation],
  );

  const dismissCreatedSecret = useCallback(() => {
    setCreatedSecret(null);
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<HouseholdInvitationStatus, HouseholdInvitation[]> = {
      pending: [],
      accepted: [],
      expired: [],
      revoked: [],
    };
    for (const invitation of invitations) {
      buckets[invitation.status]?.push(invitation);
    }
    return buckets;
  }, [invitations]);

  return {
    invitations,
    pending: grouped.pending,
    accepted: grouped.accepted,
    expired: grouped.expired,
    revoked: grouped.revoked,
    createdSecret,
    isLoading,
    isMutating,
    error,
    isDenied,
    refresh,
    createInvitation,
    resendInvitation,
    revokeInvitation,
    dismissCreatedSecret,
  };
}
