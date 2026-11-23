import React, { useEffect, useMemo, useState } from 'react';
import { History, EyeOff, MapPin, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildQrAccessHistory,
  downloadQrAccessHistoryCsv,
  paginateQrAccessHistory,
  DEFAULT_PAGE_SIZE,
  RawAccessEntry,
} from '@/utils/qrAccessHistory';

interface QrAccessHistoryProps {
  /** Raw scan records from the backend (may be null/empty while loading). */
  entries?: RawAccessEntry[] | null;
  /** When true, the owner has not enabled history or the backend denied it. */
  denied?: boolean;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
  /** Rows per page in the paginated log. */
  pageSize?: number;
}

/**
 * Shows the owner a coarse, privacy-preserving history of who scanned their
 * public QR profile.
 *
 * Privacy model (authorization/consent stays with the backend):
 *  - Only a coarse time bucket (hour resolution) and the region (when recorded)
 *    are ever shown.
 *  - Scanner identity and precise location are stripped by buildQrAccessHistory
 *    and can never reach this component.
 *
 * Keyboard / screen-reader friendly: a labelled <section>, a live
 * `role="status"` summary, a real <ul role="list">, and status text that does
 * not rely on colour alone.
 */
export function QrAccessHistory({ entries, denied, id, pageSize }: QrAccessHistoryProps) {
  const history = useMemo(() => buildQrAccessHistory(entries, { denied }), [entries, denied]);
  const [page, setPage] = useState(1);
  const listId = `${id ?? 'qr-access-history'}-list`;

  // Reset to the first page whenever the underlying log changes.
  useEffect(() => {
    setPage(1);
  }, [entries, denied]);

  const paginated = paginateQrAccessHistory(history.entries, {
    page,
    pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
  });

  const handleExport = () => {
    downloadQrAccessHistoryCsv(history.entries);
  };

  return (
    <section
      id={id}
      aria-label="Public QR profile access history"
      className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <History size={16} className="text-indigo-600" aria-hidden="true" />
          Who scanned your public profile
        </h2>
        {!history.denied && history.hasEntries ? (
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            Export CSV
          </button>
        ) : null}
      </div>

      <p className="text-xs text-gray-500 mt-1" role="status">
        {history.summary}
      </p>

      {history.denied ? (
        <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
          <EyeOff size={14} className="text-gray-400" aria-hidden="true" />
          Turn on access history to see coarse scan activity here.
        </p>
      ) : history.hasEntries ? (
        <>
          <ul role="list" id={listId} className="mt-3 space-y-2">
            {paginated.entries.map((entry, index) => (
              <li
                key={`${entry.bucket ?? 'unknown'}-${paginated.startIndex + index}`}
                role="listitem"
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-gray-800">{entry.bucketLabel}</span>
                <span
                  className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-xs font-bold"
                  aria-label={
                    entry.regionAvailable ? `Region: ${entry.region}` : 'Region not recorded'
                  }
                >
                  <MapPin size={12} aria-hidden="true" />
                  {entry.regionAvailable ? entry.region : 'Region not recorded'}
                </span>
              </li>
            ))}
          </ul>

          {paginated.totalPages > 1 ? (
            <nav
              aria-label="Access history pagination"
              className="flex items-center justify-center gap-3 pt-3"
            >
              <button
                type="button"
                disabled={!paginated.hasPrevious}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} aria-hidden="true" /> Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {paginated.page} of {paginated.totalPages}
              </span>
              <button
                type="button"
                disabled={!paginated.hasNext}
                onClick={() => setPage((p) => Math.min(paginated.totalPages, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          When someone scans your public profile, a coarse, privacy-preserving entry will appear here.
        </p>
      )}

      {history.note ? (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          {history.note}
        </p>
      ) : null}
    </section>
  );
}

export default QrAccessHistory;
