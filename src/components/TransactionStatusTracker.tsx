import { useEffect, useMemo, useRef, useState } from 'react';

import { transactionAPI } from '@/lib/api/transactionAPI';
import type { Transaction } from '@/lib/api/transactionAPI';
import { getExplorerTxUrl } from '@/lib/explorer';
import {
  getFinality,
  getFinalityMeta,
  reconcileTransactions,
  type ReconciledTransaction,
  type TransactionFinality,
} from '@/lib/transactionFinality';

export const BASE_INTERVAL = 10_000;
export const MAX_INTERVAL = 160_000;

type AnnouncedStatus = 'pending' | 'confirmed' | 'failed' | 'replaced' | 'expired';

const toneClasses: Record<string, string> = {
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-700',
  neutral: 'bg-gray-50 border-gray-200 text-gray-700',
};

const badgeTone: Record<string, string> = {
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
};

function truncateHash(hash: string): string {
  if (!hash) return '—';
  return hash.length > 12 ? `${hash.substring(0, 10)}…${hash.substring(hash.length - 4)}` : hash;
}

export default function TransactionStatusTracker() {
  const [pending, setPending] = useState<Transaction[]>([]);
  const [failed, setFailed] = useState<Transaction[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(BASE_INTERVAL);
  const announcedStatusesRef = useRef<Map<string, AnnouncedStatus> | null>(null);

  const scheduleNext = (delay: number) => {
    if (intervalRef.current) clearTimeout(intervalRef.current);
    intervalRef.current = setTimeout(poll, delay);
  };

  const poll = async () => {
    try {
      const [pendingTxs, failedTxs] = await Promise.all([
        transactionAPI.getPendingTransactions(),
        transactionAPI.getFailedTransactions(),
      ]);
      setPending(pendingTxs);
      setFailed(failedTxs);
      setPollError(null);
      delayRef.current = BASE_INTERVAL;
    } catch (error) {
      console.error('Failed to load transaction status:', error);
      setPollError(error instanceof Error ? error.message : 'Failed to refresh transaction status');
      delayRef.current = Math.min(delayRef.current * 2, MAX_INTERVAL);
    } finally {
      setIsInitialLoading(false);
      scheduleNext(delayRef.current);
    }
  };

  useEffect(() => {
    poll();
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (announcementClearTimeoutRef.current) {
        clearTimeout(announcementClearTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    const [pendingTxs, failedTxs] = await Promise.all([
      transactionAPI.getPendingTransactions(),
      transactionAPI.getFailedTransactions(),
    ]);
    setPending(pendingTxs);
    setFailed(failedTxs);
  };

  const handleCancel = async (id: string) => {
    setActionError(null);
    setPendingActionId(id);
    try {
      await transactionAPI.cancelPendingTransaction(id);
      await loadTransactions();
    } catch {
      setActionError('Could not cancel this transaction. Refresh its status and try again if appropriate.');
    } finally {
      setPendingActionId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionError(null);
    setPendingActionId(id);
    try {
      // The server owns authorization and consent checks and refreshes sequence data.
      await transactionAPI.retryFailedTransaction(id);
      await loadTransactions();
    } catch {
      setActionError('Retry was not completed. Refresh transaction status before trying again.');
    } finally {
      setPendingActionId(null);
    }
  };

  const reconciled: ReconciledTransaction[] = useMemo(
    () => reconcileTransactions(pending, failed),
    [pending, failed]
  );

  // Also include confirmed-like txs that report status confirmed but happened to be in pending/failed lists
  // (reconcile already maps via getFinality). Unknown includes conflicts.
  const grouped = useMemo(() => {
    const byFinality: Record<TransactionFinality, ReconciledTransaction[]> = {
      submitted: [],
      accepted: [],
      confirmed: [],
      failed: [],
      unknown: [],
    };
    for (const r of reconciled) byFinality[r.finality].push(r);
    // Fallback: also surface pure failed/confirmed that weren't reconciled via pending? Already covered.
    return byFinality;
  }, [reconciled]);

  const hasAny = reconciled.length > 0;

  useEffect(() => {
    if (isInitialLoading || pollError) return;

    const currentStatuses = new Map<string, AnnouncedStatus>();
    for (const { tx, finality } of reconciled) {
      if (finality === 'submitted' || finality === 'accepted') {
        currentStatuses.set(tx.id, 'pending');
      } else if (
        finality === 'confirmed' ||
        finality === 'failed' ||
        finality === 'replaced' ||
        finality === 'expired'
      ) {
        currentStatuses.set(tx.id, finality);
      }
    }

    const previousStatuses = announcedStatusesRef.current;
    announcedStatusesRef.current = currentStatuses;
    const changedCounts: Record<AnnouncedStatus, number> = {
      pending: 0,
      confirmed: 0,
      failed: 0,
      replaced: 0,
      expired: 0,
    };

    for (const [id, status] of currentStatuses) {
      if (previousStatuses?.get(id) !== status) changedCounts[status] += 1;
    }

    const nextAnnouncement = (['pending', 'confirmed', 'failed', 'replaced', 'expired'] as const)
      .filter((status) => changedCounts[status] > 0)
      .map((status) => {
        const count = changedCounts[status];
        return `${count} transaction${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} ${status}.`;
      })
      .join(' ');

    if (!nextAnnouncement) return;

    setAnnouncement(nextAnnouncement);
    if (announcementClearTimeoutRef.current) {
      clearTimeout(announcementClearTimeoutRef.current);
    }
    announcementClearTimeoutRef.current = setTimeout(() => {
      setAnnouncement('');
      announcementClearTimeoutRef.current = null;
    }, BASE_INTERVAL / 2);
  }, [reconciled, isInitialLoading, pollError]);

  // Empty state: hide tracker when no data and no error and done loading (matches previous behaviour)
  if (!hasAny && !pollError && isInitialLoading) {
    return (
      <>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <div
          aria-busy="true"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white shadow-lg rounded-lg border p-4"
        >
          <h2 className="font-semibold text-sm mb-2">Transaction Status</h2>
          <p className="text-sm text-gray-500 animate-pulse" role="status">
            Loading transactions…
          </p>
        </div>
      </>
    );
  }

  if (!hasAny && !pollError && !isInitialLoading) {
    return (
      <>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
      </>
    );
  }

  const renderSection = (finality: TransactionFinality, items: ReconciledTransaction[]) => {
    if (items.length === 0) return null;
    const meta = getFinalityMeta(finality);
    const toneClass = toneClasses[meta.tone] ?? toneClasses.neutral;
    const badgeClass = badgeTone[meta.tone] ?? badgeTone.neutral;

    return (
      <section key={finality} aria-labelledby={`tx-finality-${finality}`} className="mb-4 last:mb-0">
        <div className="flex items-center gap-2 mb-1">
          <h3
            id={`tx-finality-${finality}`}
            className="text-sm font-semibold text-gray-700 flex items-center gap-2"
          >
            {meta.label}
            <span className="text-xs font-normal text-gray-500">({items.length})</span>
          </h3>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeClass}`}
            aria-hidden="true"
          >
            {meta.label}
          </span>
        </div>
        <p className={`text-xs rounded px-2 py-1.5 border mb-2 ${toneClass}`}>{meta.guidance}</p>
        <ul className="space-y-2" role="list">
          {items.map(({ tx, finality: f, isConflict }) => {
            const itemMeta = getFinalityMeta(f);
            const explorerUrl = tx.hash ? getExplorerTxUrl(tx.hash) : null;
            const showCancel = f === 'submitted' || f === 'accepted';
            const showRetry = f === 'failed' || f === 'replaced' || f === 'expired';
            const isActionPending = pendingActionId === tx.id;
            const isAnyActionPending = pendingActionId !== null;
            return (
              <li
                key={tx.id}
                className={`flex flex-col gap-1 p-2 rounded border ${toneClass}`}
                data-testid={`tx-row-${f}-${tx.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={tx.type}>
                      {tx.type}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate" title={tx.hash}>
                      {truncateHash(tx.hash)} · {new Date(tx.timestamp).toLocaleString()}
                    </p>
                    {isConflict && (
                      <p className="text-xs text-gray-600 mt-1" role="note">
                        Conflicting status returned by provider — verify on explorer before acting.
                      </p>
                    )}
                    {tx.errorMessage && f === 'failed' && (
                      <p className="text-xs text-red-600 mt-1 line-clamp-2">{tx.errorMessage}</p>
                    )}
                    {f === 'unknown' && !isConflict && (
                      <p className="text-xs text-gray-600 mt-1">
                        Provider did not return a definite state.
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeTone[itemMeta.tone]}`}
                    aria-label={`Finality ${itemMeta.label}`}
                  >
                    {itemMeta.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1"
                      aria-label={`View transaction ${truncateHash(tx.hash)} on Stellar explorer`}
                    >
                      View on explorer
                    </a>
                  )}
                  {showCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(tx.id)}
                      disabled={isAnyActionPending}
                      aria-busy={isActionPending}
                      className="inline-flex items-center text-xs text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded px-1"
                      aria-label={`Cancel transaction ${tx.id}`}
                    >
                      {isActionPending ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                  {showRetry && (
                    <button
                      type="button"
                      onClick={() => handleRetry(tx.id)}
                      disabled={isAnyActionPending}
                      aria-busy={isActionPending}
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1"
                      aria-label={`Retry${f === 'failed' ? '' : ` ${f}`} transaction ${tx.id}`}
                    >
                      {isActionPending ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                  {f === 'confirmed' && explorerUrl && (
                    <span className="text-xs text-gray-400">· Final</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div
        role="region"
        aria-labelledby="tx-tracker-heading"
        aria-busy={isInitialLoading}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 max-h-[80vh] overflow-auto bg-white shadow-lg rounded-lg border"
      >
        <div className="p-4">
          <h2 id="tx-tracker-heading" className="font-semibold mb-3 text-gray-900">
            Transaction Status
          </h2>

          {isInitialLoading && (
            <p className="text-sm text-gray-500 animate-pulse mb-3" role="status">
              Loading transactions…
            </p>
          )}

          {pollError && (
            <div
              role="alert"
              className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700"
            >
              Couldn&apos;t refresh transaction status — retrying… ({pollError})
            </div>
          )}

          {actionError && (
            <p role="alert" className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
              {actionError}
            </p>
          )}

          {renderSection('submitted', grouped.submitted)}
          {renderSection('accepted', grouped.accepted)}
          {renderSection('confirmed', grouped.confirmed)}
          {renderSection('failed', grouped.failed)}
          {renderSection('replaced', grouped.replaced)}
          {renderSection('expired', grouped.expired)}
          {renderSection('unknown', grouped.unknown)}

          {!hasAny && !isInitialLoading && pollError && (
            <p className="text-xs text-gray-500">
              No transactions to display. Refresh will retry automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// Re-export helper for tests that want to assert lifecycle without importing lib directly
export function getFinalityForTest(tx: Transaction): TransactionFinality {
  return getFinality(tx);
}
