import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { useStorageBreakdown } from '@/hooks/useStorageBreakdown';
import {
  CATEGORY_ORDER,
  type CategoryUsage,
  type StorageCategoryId,
} from '@/lib/offline/storageUsage';
import { formatBytes } from '@/utils/formatBytes';

interface CategoryCopy {
  label: string;
  description: string;
  confirm: (cleanableCount: number) => string;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const CATEGORY_COPY: Record<StorageCategoryId, CategoryCopy> = {
  cache: {
    label: 'Cached data',
    description: 'Saved copies of pet records for offline viewing.',
    confirm: () =>
      'Saved copies will be downloaded again when you are online. Your own changes are not affected.',
  },
  queuedChanges: {
    label: 'Queued changes',
    description: 'Edits made offline that are waiting to sync.',
    confirm: (count) =>
      `Remove ${plural(count, 'queued change')} that failed every retry? ` +
      'They were never saved to the server and cannot be recovered. ' +
      'Changes still waiting to sync and unresolved conflicts are kept.',
  },
  attachments: {
    label: 'Attachments',
    description: 'Files saved on this device for later upload.',
    confirm: (count) => `Remove ${plural(count, 'saved attachment')} from this device?`,
  },
};

/**
 * Shows how much offline storage the signed-in account uses, by category, with
 * a confirmed cleanup for each. Only counts and sizes are displayed; record
 * contents never are. Authorization stays with the backend.
 */
export default function OfflineStorageBreakdown() {
  const { status, breakdown, cleaningId, cleanupError, refresh, cleanup } = useStorageBreakdown();
  const [pendingId, setPendingId] = useState<StorageCategoryId | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  const buttonRefs = useRef<Partial<Record<StorageCategoryId, HTMLButtonElement | null>>>({});
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (pendingId) cancelRef.current?.focus();
  }, [pendingId]);

  const closeDialog = useCallback((id: StorageCategoryId) => {
    setPendingId(null);
    buttonRefs.current[id]?.focus();
  }, []);

  const confirmCleanup = useCallback(
    async (id: StorageCategoryId) => {
      setPendingId(null);
      const result = await cleanup(id);
      headingRef.current?.focus();
      if (result) {
        setResultMessage(
          result.removed === 0
            ? `Nothing to clear in ${CATEGORY_COPY[id].label.toLowerCase()}.`
            : `Cleared ${plural(result.removed, 'item')} from ${CATEGORY_COPY[id].label.toLowerCase()}.`
        );
      } else {
        setResultMessage('');
      }
    },
    [cleanup]
  );

  const pendingCategory = breakdown?.categories.find((c) => c.id === pendingId);
  const isEmpty = breakdown?.categories.every((c) => c.itemCount === 0) ?? false;

  const renderRow = (category: CategoryUsage) => {
    const copy = CATEGORY_COPY[category.id];
    return (
      <tr key={category.id} className="border-t border-gray-100">
        <th scope="row" className="py-3 pr-4 text-left font-medium text-gray-900">
          {copy.label}
          <span className="block text-xs font-normal text-gray-500">{copy.description}</span>
        </th>
        <td className="py-3 pr-4 text-right tabular-nums">{category.itemCount}</td>
        <td className="py-3 pr-4 text-right tabular-nums">{formatBytes(category.bytes)}</td>
        <td className="py-3 text-right">
          <button
            type="button"
            ref={(el) => {
              buttonRefs.current[category.id] = el;
            }}
            aria-label={`Clear ${copy.label.toLowerCase()}`}
            disabled={category.cleanableCount === 0 || cleaningId !== null}
            onClick={() => setPendingId(category.id)}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </td>
      </tr>
    );
  };

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <p role="status" className="text-sm text-gray-600">
          Reading offline storage…
        </p>
      );
    }
    if (status === 'unauthenticated') {
      return (
        <p className="text-sm text-gray-600">Sign in to view offline storage for your account.</p>
      );
    }
    if (status === 'error' || !breakdown) {
      return (
        <div role="alert" className="text-sm text-red-700">
          <p>We couldn&apos;t read offline storage on this device.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 px-3 py-1.5 rounded-md border border-red-300 hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      );
    }
    if (isEmpty) {
      return (
        <p className="text-sm text-gray-600">
          No offline data is stored for your account on this device.
        </p>
      );
    }
    return (
      <>
        <table className="w-full text-sm">
          <caption className="sr-only">Offline storage used by your account, by category</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="pb-2 pr-4 font-medium">
                Category
              </th>
              <th scope="col" className="pb-2 pr-4 text-right font-medium">
                Items
              </th>
              <th scope="col" className="pb-2 pr-4 text-right font-medium">
                Size
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((id) => breakdown.categories.find((c) => c.id === id)).map(
              (category) => category && renderRow(category)
            )}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-500">
          Total for your account: {formatBytes(breakdown.totalBytes)}
        </p>
      </>
    );
  };

  return (
    <section
      aria-labelledby="offline-storage-heading"
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <HardDrive className="w-5 h-5 text-blue-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3
            id="offline-storage-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-gray-900 mb-1"
          >
            Offline storage
          </h3>
          <p className="text-sm text-gray-600">
            See what is saved on this device and clear it safely. Your records on the server are
            never deleted here.
          </p>
        </div>
      </div>

      {renderBody()}

      {cleanupError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {cleanupError}
        </p>
      )}

      {pendingId && pendingCategory && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="offline-storage-confirm-title"
          aria-describedby="offline-storage-confirm-desc"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDialog(pendingId);
          }}
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <p id="offline-storage-confirm-title" className="font-medium text-amber-900">
            Clear {CATEGORY_COPY[pendingId].label.toLowerCase()}?
          </p>
          <p id="offline-storage-confirm-desc" className="mt-1 text-sm text-amber-800">
            {CATEGORY_COPY[pendingId].confirm(pendingCategory.cleanableCount)}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              ref={cancelRef}
              onClick={() => closeDialog(pendingId)}
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmCleanup(pendingId)}
              className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm hover:bg-amber-700"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-3 text-sm text-green-700 empty:hidden">
        {resultMessage}
      </p>
    </section>
  );
}
