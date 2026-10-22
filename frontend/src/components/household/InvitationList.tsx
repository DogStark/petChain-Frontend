import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface HouseholdInvitation {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  /** Raw secret is only ever present on the freshly created invitation. */
  invitationSecret?: string;
}

export interface InvitationListProps {
  invitations: HouseholdInvitation[];
  loading?: boolean;
  error?: string | null;
  /** Backend owns authorization/consent; the UI only surfaces the outcome. */
  onResend?: (invitation: HouseholdInvitation) => Promise<void> | void;
  onRevoke?: (invitation: HouseholdInvitation) => Promise<void> | void;
}

const STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
  revoked: 'Revoked',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isActionable(status: InvitationStatus): boolean {
  return status === 'pending' || status === 'expired';
}

export function InvitationList({
  invitations,
  loading = false,
  error = null,
  onResend,
  onRevoke,
}: InvitationListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAction = useCallback(
    async (
      invitation: HouseholdInvitation,
      action: 'resend' | 'revoke',
      handler?: (invitation: HouseholdInvitation) => Promise<void> | void,
    ) => {
      if (!handler) {
        return;
      }
      setActionError(null);
      setBusyId(invitation.id);
      try {
        await handler(invitation);
        if (mountedRef.current) {
          setAnnouncement(
            action === 'resend'
              ? `Invitation to ${invitation.email} resent.`
              : `Invitation to ${invitation.email} revoked.`,
          );
        }
      } catch (err) {
        if (mountedRef.current) {
          setActionError(
            err instanceof Error && err.message
              ? err.message
              : `Unable to ${action} the invitation. Please try again.`,
          );
        }
      } finally {
        if (mountedRef.current) {
          setBusyId(null);
        }
      }
    },
    [],
  );

  const sorted = useMemo(() => {
    const order: Record<InvitationStatus, number> = {
      pending: 0,
      expired: 1,
      accepted: 2,
      revoked: 3,
    };
    return [...invitations].sort((a, b) => order[a.status] - order[b.status]);
  }, [invitations]);

  if (loading) {
    return (
      <section aria-labelledby="invitations-heading" aria-busy="true">
        <h2 id="invitations-heading">Household invitations</h2>
        <p role="status">Loading invitations…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="invitations-heading">
        <h2 id="invitations-heading">Household invitations</h2>
        <p role="alert">{error}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="invitations-heading">
      <h2 id="invitations-heading">Household invitations</h2>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {actionError ? <p role="alert">{actionError}</p> : null}

      {sorted.length === 0 ? (
        <p>No invitations yet. Invite a household member to get started.</p>
      ) : (
        <ul aria-labelledby="invitations-heading">
          {sorted.map((invitation) => {
            const actionable = isActionable(invitation.status);
            const busy = busyId === invitation.id;
            return (
              <li key={invitation.id}>
                <div>
                  <span>{invitation.email}</span>{' '}
                  <span>{invitation.role}</span>{' '}
                  <span>{STATUS_LABELS[invitation.status]}</span>
                </div>
                <div>
                  <span>Invited {formatDate(invitation.createdAt)}</span>{' '}
                  <span>Expires {formatDate(invitation.expiresAt)}</span>
                </div>
                {invitation.invitationSecret ? (
                  <p>
                    Share this one-time invitation code now — it will not be
                    shown again: <code>{invitation.invitationSecret}</code>
                  </p>
                ) : null}
                {actionable ? (
                  <div role="group" aria-label={`Actions for ${invitation.email}`}>
                    <button
                      type="button"
                      disabled={busy || !onResend}
                      aria-busy={busy}
                      onClick={() => runAction(invitation, 'resend', onResend)}
                    >
                      Resend
                    </button>{' '}
                    <button
                      type="button"
                      disabled={busy || !onRevoke}
                      aria-busy={busy}
                      onClick={() => runAction(invitation, 'revoke', onRevoke)}
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default InvitationList;
