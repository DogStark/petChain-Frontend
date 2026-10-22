'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Notification action with a review/confirmation step for clinical changes.
 *
 * Authorization and consent decisions are owned by the backend: this component
 * only collects an explicit user confirmation before dispatching the action and
 * surfaces backend denials/stale-state responses to the user.
 */

export type ClinicalActionKind = 'medication' | 'appointment';

export interface NotificationActionProps {
  /** Identifier of the notification this action belongs to. */
  notificationId: string;
  /** Human readable label for the action, e.g. "Approve refill". */
  label: string;
  /** Whether this action mutates medication or appointment state. */
  clinicalKind?: ClinicalActionKind;
  /** Short description of what the action will change, shown in the review step. */
  summary?: string;
  /** Server version/timestamp the notification was rendered from. */
  serverVersion?: string;
  /**
   * Dispatches the action. Must resolve with the current server state so stale
   * notifications can be routed to it. Rejections are treated as failures.
   */
  onConfirm: (context: {
    notificationId: string;
    serverVersion?: string;
  }) => Promise<NotificationActionResult>;
  /** Called when the backend reports the notification is stale. */
  onStale?: (current: NotificationActionResult) => void;
  disabled?: boolean;
}

export interface NotificationActionResult {
  ok: boolean;
  /** Backend-owned decision, e.g. "denied" when consent/authorization fails. */
  status?: 'applied' | 'denied' | 'stale' | 'error';
  /** Latest server state to route the user to when stale. */
  currentState?: { version?: string; message?: string; href?: string };
  message?: string;
}

export function NotificationAction({
  notificationId,
  label,
  clinicalKind,
  summary,
  serverVersion,
  onConfirm,
  onStale,
  disabled = false,
}: NotificationActionProps) {
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<NotificationActionResult['currentState'] | null>(null);

  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const requiresReview = Boolean(clinicalKind);

  const closeReview = useCallback(() => {
    setReviewing(false);
    setError(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!reviewing) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        event.preventDefault();
        closeReview();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reviewing, pending, closeReview]);

  const runAction = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm({ notificationId, serverVersion });
      if (result.status === 'stale') {
        setStale(result.currentState ?? {});
        setReviewing(false);
        onStale?.(result);
        return;
      }
      if (!result.ok) {
        setError(result.message ?? 'This action could not be completed.');
        return;
      }
      setReviewing(false);
    } catch {
      setError('This action could not be completed. Please try again.');
    } finally {
      setPending(false);
    }
  }, [notificationId, serverVersion, onConfirm, onStale]);

  const handleTrigger = () => {
    if (disabled || pending) return;
    if (requiresReview) {
      setReviewing(true);
      return;
    }
    void runAction();
  };

  if (stale) {
    return (
      <div role="status" aria-live="polite" className="notification-action-stale">
        <p>
          {stale.message ??
            'This notification is out of date. Showing the current server state instead.'}
        </p>
        {stale.href ? (
          <a href={stale.href}>View current state</a>
        ) : (
          <button type="button" onClick={() => setStale(null)}>
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="notification-action">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTrigger}
        disabled={disabled || pending}
        aria-haspopup={requiresReview ? 'dialog' : undefined}
        aria-expanded={requiresReview ? reviewing : undefined}
      >
        {pending && !reviewing ? 'Working…' : label}
      </button>

      {reviewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="notification-action-review"
        >
          <h2 id={titleId}>Review {clinicalKind} change</h2>
          <p id={descId}>
            {summary ??
              `Confirming will update the ${clinicalKind} state for this notification.`}
          </p>
          {error && (
            <p role="alert" className="notification-action-error">
              {error}
            </p>
          )}
          <div className="notification-action-controls">
            <button
              ref={confirmRef}
              type="button"
              onClick={() => void runAction()}
              disabled={pending}
            >
              {pending ? 'Confirming…' : 'Confirm change'}
            </button>
            <button type="button" onClick={closeReview} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && !reviewing && (
        <p role="alert" className="notification-action-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default NotificationAction;
