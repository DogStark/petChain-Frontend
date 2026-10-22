'use client';

import { useCallback, useState } from 'react';

/**
 * Notification action types that mutate clinical state. These require an
 * explicit review/confirmation step before the backend is asked to apply them.
 * Authorization and consent decisions remain owned by the backend.
 */
export type ClinicalActionType = 'medication' | 'appointment';

export interface NotificationAction {
  id: string;
  type: ClinicalActionType;
  label: string;
  /** Server version of the notification this action was rendered from. */
  notificationVersion?: string | number;
  /** Optional human-readable summary of the change for the review step. */
  summary?: string;
}

export interface NotificationActionClient {
  /**
   * Applies the action on the server. The backend is the source of truth for
   * authorization, consent, and whether the action is still valid.
   */
  applyAction: (action: NotificationAction) => Promise<unknown>;
  /**
   * Fetches the current server state for a notification so stale actions can
   * be routed to the latest state instead of being applied blindly.
   */
  fetchCurrentState: (notificationId: string) => Promise<unknown>;
}

export type NotificationActionStatus =
  | 'idle'
  | 'reviewing'
  | 'submitting'
  | 'stale'
  | 'denied'
  | 'error';

export interface UseNotificationActionsResult {
  status: NotificationActionStatus;
  /** The action currently awaiting confirmation, if any. */
  pendingAction: NotificationAction | null;
  /** Latest server state when a stale notification was detected. */
  currentState: unknown;
  error: Error | null;
  /** Opens the review step for a clinical action. */
  requestAction: (action: NotificationAction) => void;
  /** Confirms the reviewed action and submits it to the backend. */
  confirmAction: () => Promise<void>;
  /** Cancels the review step without applying anything. */
  cancelAction: () => void;
  /** Re-routes a stale notification to the current server state. */
  refreshToCurrentState: (notificationId: string) => Promise<void>;
  reset: () => void;
}

function isStaleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; code?: string };
  return (
    candidate.status === 409 ||
    candidate.status === 410 ||
    candidate.code === 'STALE_NOTIFICATION' ||
    candidate.code === 'VERSION_CONFLICT'
  );
}

function isDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: number; code?: string };
  return (
    candidate.status === 401 ||
    candidate.status === 403 ||
    candidate.code === 'FORBIDDEN' ||
    candidate.code === 'CONSENT_REQUIRED'
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Manages the review/confirmation flow for notification actions that change
 * medication or appointment state. Clinical actions are never applied without
 * an explicit confirmation, and stale notifications are routed to the current
 * server state rather than being applied against outdated data.
 */
export function useNotificationActions(
  client: NotificationActionClient,
): UseNotificationActionsResult {
  const [status, setStatus] = useState<NotificationActionStatus>('idle');
  const [pendingAction, setPendingAction] = useState<NotificationAction | null>(
    null,
  );
  const [currentState, setCurrentState] = useState<unknown>(null);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setPendingAction(null);
    setCurrentState(null);
    setError(null);
  }, []);

  const requestAction = useCallback((action: NotificationAction) => {
    setPendingAction(action);
    setCurrentState(null);
    setError(null);
    setStatus('reviewing');
  }, []);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
    setCurrentState(null);
    setError(null);
    setStatus('idle');
  }, []);

  const refreshToCurrentState = useCallback(
    async (notificationId: string) => {
      setStatus('submitting');
      setError(null);
      try {
        const state = await client.fetchCurrentState(notificationId);
        setCurrentState(state);
        setPendingAction(null);
        setStatus('stale');
      } catch (err) {
        setError(toError(err));
        setStatus('error');
      }
    },
    [client],
  );

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;
    setStatus('submitting');
    setError(null);
    try {
      await client.applyAction(pendingAction);
      setPendingAction(null);
      setStatus('idle');
    } catch (err) {
      if (isStaleError(err)) {
        // Route stale notifications to the current server state instead of
        // retrying the outdated action.
        await refreshToCurrentState(pendingAction.id);
        return;
      }
      if (isDeniedError(err)) {
        setError(toError(err));
        setStatus('denied');
        return;
      }
      setError(toError(err));
      setStatus('error');
    }
  }, [client, pendingAction, refreshToCurrentState]);

  return {
    status,
    pendingAction,
    currentState,
    error,
    requestAction,
    confirmAction,
    cancelAction,
    refreshToCurrentState,
    reset,
  };
}
