import { useState, useEffect, useCallback } from 'react';
import {
  gdprService,
  UserConsent,
  ConsentType,
  DeletionRequest,
  ACTIVE_DELETION_STATUSES,
  getGdprErrorMessage,
} from '@/lib/gdpr';

/** Which async action is currently in flight, so duplicate submissions can be blocked. */
export type GdprAction = 'export' | 'requestDeletion' | 'cancelDeletion' | null;

export function useGdpr(userId: string) {
  const [consents, setConsents] = useState<UserConsent[]>([]);
  const [deletionStatus, setDeletionStatus] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<GdprAction>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [consentData, deletion] = await Promise.all([
        gdprService.getConsents(userId),
        gdprService.getDeletionStatus(userId),
      ]);

      if (!consentData.length) {
        const defaults = await gdprService.initConsents(userId);
        setConsents(defaults);
      } else {
        setConsents(consentData);
      }
      // Restores in-flight/completed erasure state across reloads so the UI
      // never lets a user fire a second deletion request against a pending one.
      setDeletionStatus(deletion);
    } catch (e) {
      setError(getGdprErrorMessage(e, 'Failed to load privacy settings'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      try {
        const updated = await gdprService.updateConsent(userId, type, granted);
        setConsents((prev) => prev.map((c) => (c.type === type ? updated : c)));
      } catch (e) {
        setError(getGdprErrorMessage(e, 'Failed to update consent'));
      }
    },
    [userId]
  );

  const exportData = useCallback(async () => {
    if (pendingAction) return;
    setPendingAction('export');
    setError(null);
    try {
      await gdprService.exportData(userId);
    } catch (e) {
      setError(getGdprErrorMessage(e, 'Export failed'));
    } finally {
      setPendingAction(null);
    }
  }, [userId, pendingAction]);

  const requestDeletion = useCallback(
    async (reason?: string) => {
      // Guard against duplicate erasure requests while one is already in flight.
      if (pendingAction || (deletionStatus && ACTIVE_DELETION_STATUSES.includes(deletionStatus.status))) {
        return deletionStatus;
      }
      setPendingAction('requestDeletion');
      setError(null);
      try {
        const result = await gdprService.requestDeletion(userId, reason);
        setDeletionStatus(result);
        return result;
      } catch (e) {
        setError(getGdprErrorMessage(e, 'Deletion request failed'));
        return null;
      } finally {
        setPendingAction(null);
      }
    },
    [userId, pendingAction, deletionStatus]
  );

  const cancelDeletion = useCallback(async () => {
    if (pendingAction || !deletionStatus || !ACTIVE_DELETION_STATUSES.includes(deletionStatus.status)) {
      return null;
    }
    setPendingAction('cancelDeletion');
    setError(null);
    try {
      const result = await gdprService.cancelDeletion(userId);
      setDeletionStatus(result);
      return result;
    } catch (e) {
      setError(getGdprErrorMessage(e, 'Failed to cancel deletion request'));
      return null;
    } finally {
      setPendingAction(null);
    }
  }, [userId, pendingAction, deletionStatus]);

  return {
    consents,
    deletionStatus,
    loading,
    pendingAction,
    error,
    updateConsent,
    exportData,
    requestDeletion,
    cancelDeletion,
  };
}
