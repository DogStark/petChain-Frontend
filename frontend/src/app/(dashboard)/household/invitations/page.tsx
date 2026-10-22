'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

interface CreatedInvitation extends Invitation {
  // Only present in the create response; never re-fetched or persisted client-side.
  secret?: string;
}

const STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
  revoked: 'Revoked',
};

const STATUS_STYLES: Record<InvitationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-800',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HouseholdInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const secretRef = useRef<HTMLDivElement | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/household/invitations', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.status === 401 || res.status === 403) {
        setError('You do not have permission to manage household invitations.');
        setInvitations([]);
        return;
      }
      if (!res.ok) throw new Error('Failed to load invitations');
      const data = (await res.json()) as { invitations?: Invitation[] };
      setInvitations(Array.isArray(data.invitations) ? data.invitations : []);
    } catch {
      setError('Unable to load invitations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const handleResend = useCallback(async (invitation: Invitation) => {
    setBusyId(invitation.id);
    setAnnouncement('');
    try {
      const res = await fetch(`/api/household/invitations/${encodeURIComponent(invitation.id)}/resend`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.status === 401 || res.status === 403) {
        setAnnouncement('You do not have permission to resend this invitation.');
        return;
      }
      if (!res.ok) throw new Error('resend failed');
      setAnnouncement(`Invitation to ${invitation.email} was resent.`);
      await loadInvitations();
    } catch {
      setAnnouncement(`Could not resend the invitation to ${invitation.email}.`);
    } finally {
      setBusyId(null);
    }
  }, [loadInvitations]);

  const handleRevoke = useCallback(async (invitation: Invitation) => {
    setBusyId(invitation.id);
    setAnnouncement('');
    try {
      const res = await fetch(`/api/household/invitations/${encodeURIComponent(invitation.id)}/revoke`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.status === 401 || res.status === 403) {
        setAnnouncement('You do not have permission to revoke this invitation.');
        return;
      }
      if (!res.ok) throw new Error('revoke failed');
      setAnnouncement(`Invitation to ${invitation.email} was revoked.`);
      await loadInvitations();
    } catch {
      setAnnouncement(`Could not revoke the invitation to ${invitation.email}.`);
    } finally {
      setBusyId(null);
    }
  }, [loadInvitations]);

  const handleDismissSecret = useCallback(() => {
    setCreatedSecret(null);
  }, []);

  const canResend = (status: InvitationStatus) => status === 'pending' || status === 'expired';
  const canRevoke = (status: InvitationStatus) => status === 'pending';

  const grouped = useMemo(() => {
    const order: InvitationStatus[] = ['pending', 'accepted', 'expired', 'revoked'];
    return order.map((status) => ({
      status,
      items: invitations.filter((inv) => inv.status === status),
    }));
  }, [invitations]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Household invitations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage invitations to join your household. Access decisions are enforced by the server.
        </p>
      </header>

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {createdSecret && (
        <div
          ref={secretRef}
          role="alert"
          className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-medium text-amber-900">
            Invitation created. Copy this secret now — it will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-sm text-gray-900">
            {createdSecret.secret}
          </code>
          <button
            type="button"
            onClick={handleDismissSecret}
            className="mt-3 rounded-md border border-amber-400 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && (
        <p role="status" className="text-sm text-gray-600">Loading invitations…</p>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && invitations.length === 0 && (
        <p className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No invitations yet. Invite a household member to get started.
        </p>
      )}

      {!loading && !error && invitations.length > 0 && (
        <div className="space-y-8">
          {grouped.map(({ status, items }) =>
            items.length === 0 ? null : (
              <section key={status} aria-labelledby={`invitations-${status}`}>
                <h2 id={`invitations-${status}`} className="mb-2 text-lg font-medium text-gray-900">
                  {STATUS_LABELS[status]} ({items.length})
                </h2>
                <ul className="space-y-3">
                  {items.map((invitation) => {
                    const busy = busyId === invitation.id;
                    return (
                      <li
                        key={invitation.id}
                        className="rounded-md border border-gray-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{invitation.email}</p>
                            <p className="text-sm text-gray-600">
                              Role: {invitation.role} · Invited {formatDate(invitation.createdAt)} · Expires{' '}
                              {formatDate(invitation.expiresAt)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invitation.status]}`}
                          >
                            {STATUS_LABELS[invitation.status]}
                          </span>
                        </div>
                        {(canResend(invitation.status) || canRevoke(invitation.status)) && (
                          <div className="mt-3 flex gap-2">
                            {canResend(invitation.status) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleResend(invitation)}
                                aria-label={`Resend invitation to ${invitation.email}`}
                                className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                              >
                                {busy ? 'Working…' : 'Resend'}
                              </button>
                            )}
                            {canRevoke(invitation.status) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleRevoke(invitation)}
                                aria-label={`Revoke invitation to ${invitation.email}`}
                                className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                              >
                                {busy ? 'Working…' : 'Revoke'}
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </main>
  );
}
