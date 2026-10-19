import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { useWallet } from '../../wallet/useWallet';
import { requestAccountDeletion, getDeletionStatus } from './api';
import { purgeServiceWorkerCaches } from '../../lib/cache';

type DeletionState =
  | { status: 'idle' }
  | { status: 'pending'; requestedAt: string }
  | { status: 'confirmed' }
  | { status: 'failed'; message: string };

export function AccountSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { clearWallet } = useWallet();
  const [deletion, setDeletion] = useState<DeletionState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);

  // On mount, reconcile any in-flight deletion so a pending request is never
  // mistaken for completion (e.g. after a reload or back navigation).
  useEffect(() => {
    let cancelled = false;
    getDeletionStatus()
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'pending') {
          setDeletion({ status: 'pending', requestedAt: res.requestedAt });
        } else if (res.status === 'confirmed') {
          setDeletion({ status: 'confirmed' });
        }
      })
      .catch(() => {
        /* no deletion in flight */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once deletion is confirmed, purge all user-scoped state and caches, then
  // replace the history entry so back navigation cannot reveal protected content.
  useEffect(() => {
    if (deletion.status !== 'confirmed') return;
    let active = true;
    (async () => {
      queryClient.clear();
      await purgeServiceWorkerCaches();
      clearWallet();
      await signOut();
      if (active) navigate('/goodbye', { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [deletion.status, queryClient, clearWallet, signOut, navigate]);

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await requestAccountDeletion();
      if (res.status === 'confirmed') {
        setDeletion({ status: 'confirmed' });
      } else {
        setDeletion({ status: 'pending', requestedAt: res.requestedAt });
      }
    } catch (err) {
      setDeletion({
        status: 'failed',
        message: err instanceof Error ? err.message : 'Deletion failed',
      });
    } finally {
      setSubmitting(false);
    }
  }, []);

  return (
    <section className="account-settings">
      <h1>Account settings</h1>

      {deletion.status === 'pending' && (
        <div role="status" className="deletion-pending">
          <p>
            Your account deletion is pending and has not completed yet. You can
            keep using your account until it is confirmed.
          </p>
          <a href="/support/deletion">Contact support about this request</a>
        </div>
      )}

      {deletion.status === 'failed' && (
        <div role="alert" className="deletion-failed">
          <p>We could not delete your account: {deletion.message}</p>
          <button type="button" onClick={handleDelete} disabled={submitting}>
            Try again
          </button>
        </div>
      )}

      {deletion.status === 'confirmed' && (
        <div role="status" className="deletion-confirmed">
          <p>Your account has been deleted. Signing you out…</p>
        </div>
      )}

      {deletion.status === 'idle' && (
        <button type="button" onClick={handleDelete} disabled={submitting}>
          {submitting ? 'Requesting deletion…' : 'Delete my account'}
        </button>
      )}
    </section>
  );
}
