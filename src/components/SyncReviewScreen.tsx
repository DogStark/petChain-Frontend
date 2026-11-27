/**
 * SyncReviewScreen component
 *
 * Displays a summary of queued offline changes before they are replayed to the
 * server. Users can cancel individual items and resolve any existing conflicts
 * (keep local, keep server, or merge field by field). Issue #1142, #1412.
 *
 * Accessibility:
 * - Live regions announce loading, error and resolution states.
 * - Each action row is a labelled listitem with a clearly labelled cancel button.
 * - Conflicts are rendered as a captioned comparison table with labelled
 *   radio groups and per-conflict action buttons.
 * - Keyboard navigation follows natural DOM order; no focus traps.
 */

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { useSyncReview } from '@/hooks/useSyncReview';
import type { SyncQueueItem, SyncConflictSnapshot } from '@/lib/offline/indexedDB';
import type { ConflictResolutionStrategy } from '@/lib/offline/syncManager';

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

function displayValue(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? 'Not present';
  } catch {
    return 'Value cannot be displayed';
  }
}

interface ConflictCardProps {
  conflict: SyncConflictSnapshot;
  index: number;
  isResolving: boolean;
  onResolve: (
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    fieldChoices?: Record<string, 'local' | 'server'>,
  ) => void;
}

function ConflictCard({ conflict, index, isResolving, onResolve }: ConflictCardProps) {
  const fields = React.useMemo(
    () =>
      Array.from(
        new Set([...Object.keys(conflict.localData), ...Object.keys(conflict.serverData)]),
      ).sort(),
    [conflict],
  );
  const [choices, setChoices] = useState<Record<string, 'local' | 'server'>>({});
  const displayEndpoint = conflict.endpoint.replace(/^\/api\/v\d+/, '');
  const headingId = `conflict-${index}-heading`;

  return (
    <li className="rounded-lg border border-amber-200 bg-white p-4">
      <h3 id={headingId} className="text-sm font-semibold text-gray-900">
        Conflict {index + 1}
        <span className="ml-2 font-normal text-gray-500">{displayEndpoint}</span>
      </h3>

      {fields.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">
          No comparable fields were included with this conflict.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Local and server values for conflict {index + 1} on {displayEndpoint}
            </caption>
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Field
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Local value
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Server value
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Keep
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const selected = choices[field] ?? 'server';
                return (
                  <tr key={field} className="border-b border-gray-100 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium text-gray-800">
                      {field}
                    </th>
                    <td className="py-2 pr-3">
                      <pre className="whitespace-pre-wrap break-words font-sans text-gray-700">
                        {displayValue(conflict.localData[field])}
                      </pre>
                    </td>
                    <td className="py-2 pr-3">
                      <pre className="whitespace-pre-wrap break-words font-sans text-gray-700">
                        {displayValue(conflict.serverData[field])}
                      </pre>
                    </td>
                    <td className="py-2">
                      <fieldset className="flex gap-3">
                        <legend className="sr-only">Keep which value for {field}</legend>
                        {(['local', 'server'] as const).map((source) => (
                          <label
                            key={source}
                            className="flex cursor-pointer items-center gap-1 text-xs text-gray-700"
                          >
                            <input
                              type="radio"
                              name={`conflict-${index}-field-${field}`}
                              value={source}
                              checked={selected === source}
                              onChange={() =>
                                setChoices((current) => ({ ...current, [field]: source }))
                              }
                            />
                            {source === 'local' ? 'Local' : 'Server'}
                          </label>
                        ))}
                      </fieldset>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isResolving}
          onClick={() => onResolve(conflict.conflictId, 'local')}
          aria-label={`Keep local values for conflict ${index + 1} on ${displayEndpoint}`}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Keep local
        </button>
        <button
          type="button"
          disabled={isResolving}
          onClick={() => onResolve(conflict.conflictId, 'server')}
          aria-label={`Keep server values for conflict ${index + 1} on ${displayEndpoint}`}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Keep server
        </button>
        <button
          type="button"
          disabled={isResolving || fields.length === 0}
          onClick={() => onResolve(conflict.conflictId, 'merge', choices)}
          aria-label={`Merge selected values for conflict ${index + 1} on ${displayEndpoint}`}
          className="rounded bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Merge selected
        </button>
      </div>
    </li>
  );
}

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
  const { pendingItems, conflicts, isOnline, isLoading, error, cancelItem, refresh, resolveConflict } =
    useSyncReview();
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set());
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);

  const handleResolve = useCallback(
    async (
      conflictId: string,
      strategy: ConflictResolutionStrategy,
      fieldChoices?: Record<string, 'local' | 'server'>,
    ) => {
      setResolvingIds((prev) => new Set(prev).add(conflictId));
      setResolveError(null);
      try {
        await resolveConflict(conflictId, strategy, fieldChoices);
        setResolvedCount((count) => count + 1);
      } catch (err) {
        setResolveError(
          err instanceof Error
            ? err.message
            : 'Unable to resolve this conflict. Please try again.',
        );
      } finally {
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(conflictId);
          return next;
        });
      }
    },
    [resolveConflict],
  );

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
      {(error || cancelError || resolveError) && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {resolveError ?? cancelError ?? error}
        </p>
      )}

      {resolvedCount > 0 && (
        <p role="status" aria-live="polite" className="text-sm text-green-700">
          {resolvedCount} conflict{resolvedCount === 1 ? '' : 's'} resolved and logged.
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
            Compare the local and server values, then keep one side or merge field by field.
          </p>
          <ul className="mt-3 space-y-3" aria-label="Unresolved sync conflicts">
            {conflicts.map((conflict, index) => (
              <ConflictCard
                key={conflict.conflictId}
                conflict={conflict}
                index={index}
                isResolving={resolvingIds.has(conflict.conflictId)}
                onResolve={handleResolve}
              />
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Prefer a full page?{' '}
            <Link
              href={{
                pathname: '/sync/conflicts/[id]',
                query: { id: conflicts[0].conflictId },
              }}
              className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Open the detailed comparison for conflict 1
            </Link>
          </p>
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
