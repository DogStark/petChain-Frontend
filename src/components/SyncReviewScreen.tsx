/**
 * SyncReviewScreen component
 *
 * Displays a summary of queued offline changes before they are replayed to the
 * server. Users can cancel individual items and see any existing conflicts that
 * need resolution. Issue #1142.
 *
 * Accessibility:
 * - Live regions announce loading and error states.
 * - Each action row is a labelled listitem with a clearly labelled cancel button.
 * - Conflict links describe their destination inline.
 * - Keyboard navigation follows natural DOM order; no focus traps.
 */

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { useSyncReview } from '@/hooks/useSyncReview';
import type { SyncQueueItem } from '@/lib/offline/indexedDB';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionLabel(action: SyncQueueItem['action']): string {
  switch (action) {
    case 'create':
      return 'Create';
    case 'update':
      return 'Update';
    case 'delete':
      return 'Delete';
    default:
      return 'Change';
  }
}

function actionColorClass(action: SyncQueueItem['action']): string {
  switch (action) {
    case 'create':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'update':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'delete':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface QueueItemRowProps {
  item: SyncQueueItem;
  isCancelling: boolean;
  onCancel: (id: number) => void;
}

function QueueItemRow({ item, isCancelling, onCancel }: QueueItemRowProps) {
  const { id, action, endpoint, createdAt, retryCount } = item;
  const displayEndpoint = endpoint.replace(/^\/api\/v\d+/, '');

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${actionColorClass(action)}`}
          >
            {actionLabel(action)}
          </span>
          <code className="truncate text-sm text-gray-700" title={endpoint}>
            {displayEndpoint}
          </code>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Queued {formatTimestamp(createdAt)}
          {retryCount > 0 && (
            <span className="ml-2 text-amber-600">
              · {retryCount} retry attempt{retryCount === 1 ? '' : 's'}
            </span>
          )}
        </p>
      </div>

      {id !== undefined && (
        <button
          type="button"
          aria-label={`Cancel ${actionLabel(action)} on ${displayEndpoint}`}
          disabled={isCancelling}
          onClick={() => onCancel(id)}
          className="shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface SyncReviewScreenProps {
  /** Called when the user clicks "Start sync" to proceed with replay. */
  onConfirmSync?: () => void;
  /** Called when the user navigates away without syncing. */
  onDismiss?: () => void;
  /** Additional className for the outer container. */
  className?: string;
}

export default function SyncReviewScreen({
  onConfirmSync,
  onDismiss,
  className = '',
}: SyncReviewScreenProps) {
  const { pendingItems, conflicts, isOnline, isLoading, error, cancelItem, refresh } =
    useSyncReview();
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(
    async (id: number) => {
      setCancellingIds((prev) => new Set(prev).add(id));
      setCancelError(null);
      try {
        await cancelItem(id);
      } catch {
        setCancelError('Unable to cancel this change. Please try again.');
      } finally {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [cancelItem],
  );

  const hasChanges = pendingItems.length > 0;
  const hasConflicts = conflicts.length > 0;

  return (
    <section
      className={`mx-auto max-w-2xl space-y-6 px-4 py-8 ${className}`}
      aria-labelledby="sync-review-heading"
    >
      {/* ── Header ── */}
      <header>
        <h1 id="sync-review-heading" className="text-2xl font-bold text-gray-900">
          Review queued changes
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          The following changes were saved locally while you were offline. Review them before
          they are sent to the server. You can cancel any item you no longer want to send.
        </p>
      </header>

      {/* ── Online / offline status banner ── */}
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
          isOnline
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>You are online. Changes will be sent once you confirm.</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You are offline. Changes are saved locally and will sync when you reconnect.
            </span>
          </>
        )}
      </div>

      {/* ── Loading state ── */}
      {isLoading && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading queued changes…
        </p>
      )}

      {/* ── Load error ── */}
      {(error || cancelError) && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {cancelError ?? error}
        </p>
      )}

      {/* ── Unresolved conflicts ── */}
      {!isLoading && hasConflicts && (
        <section aria-labelledby="conflicts-heading">
          <h2
            id="conflicts-heading"
            className="flex items-center gap-2 text-base font-semibold text-amber-800"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {conflicts.length} unresolved server conflict{conflicts.length === 1 ? '' : 's'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            These items have conflicting server versions and cannot be replayed until resolved.
            Resolve each conflict before starting sync.
          </p>
          <nav aria-label="Unresolved sync conflicts" className="mt-3">
            <ul className="space-y-2">
              {conflicts.map((conflict, index) => (
                <li key={conflict.conflictId}>
                  <Link
                    href={{
                      pathname: '/sync/conflicts/[id]',
                      query: { id: conflict.conflictId },
                    }}
                    className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Resolve conflict {index + 1}
                    {conflict.endpoint && (
                      <span className="text-amber-600"> — {conflict.endpoint.replace(/^\/api\/v\d+/, '')}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      )}

      {/* ── Pending queue items ── */}
      {!isLoading && (
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-base font-semibold text-gray-900">
            {hasChanges
              ? `${pendingItems.length} pending change${pendingItems.length === 1 ? '' : 's'}`
              : 'No pending changes'}
          </h2>

          {hasChanges ? (
            <ul className="mt-3 space-y-2" aria-label="Pending offline changes">
              {pendingItems.map((item) => (
                <QueueItemRow
                  key={item.id ?? item.idempotencyKey}
                  item={item}
                  isCancelling={item.id !== undefined && cancellingIds.has(item.id)}
                  onCancel={handleCancel}
                />
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
              <span>Your queue is empty — nothing to sync right now.</span>
            </div>
          )}
        </section>
      )}

      {/* ── Summary / retry info ── */}
      {!isLoading && hasChanges && (
        <p className="text-xs text-gray-500" aria-live="polite">
          {pendingItems.filter((i) => i.retryCount > 0).length > 0 && (
            <>
              <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Items that have already failed at least once will be retried automatically with
              exponential backoff.{' '}
            </>
          )}
          Cancelled changes are removed permanently and will not be replayed.
        </p>
      )}

      {/* ── Action buttons ── */}
      {!isLoading && (
        <div className="flex flex-wrap gap-3 pt-2">
          {hasChanges && isOnline && !hasConflicts && onConfirmSync && (
            <button
              type="button"
              onClick={onConfirmSync}
              className="rounded bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Start sync
            </button>
          )}

          {hasChanges && (!isOnline || hasConflicts) && (
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-describedby={hasConflicts ? 'conflicts-heading' : undefined}
              title={
                !isOnline
                  ? 'Connect to the internet to sync your changes.'
                  : 'Resolve all conflicts before syncing.'
              }
              className="cursor-not-allowed rounded bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-400"
            >
              Start sync
            </button>
          )}

          <button
            type="button"
            onClick={refresh}
            className="rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Refresh
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Back
            </button>
          )}
        </div>
      )}
    </section>
  );
}
