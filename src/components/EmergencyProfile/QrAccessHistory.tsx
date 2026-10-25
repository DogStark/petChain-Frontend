import React from 'react';
import { History, EyeOff, MapPin } from 'lucide-react';
import { buildQrAccessHistory, RawAccessEntry } from '@/utils/qrAccessHistory';

interface QrAccessHistoryProps {
  /** Raw scan records from the backend (may be null/empty while loading). */
  entries?: RawAccessEntry[] | null;
  /** When true, the owner has not enabled history or the backend denied it. */
  denied?: boolean;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
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
export function QrAccessHistory({ entries, denied, id }: QrAccessHistoryProps) {
  const history = buildQrAccessHistory(entries, { denied });
  const listId = `${id ?? 'qr-access-history'}-list`;

  return (
    <section
      id={id}
      aria-label="Public QR profile access history"
      className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
        <History size={16} className="text-indigo-600" aria-hidden="true" />
        Who scanned your public profile
      </h2>

      <p className="text-xs text-gray-500 mt-1" role="status">
        {history.summary}
      </p>

      {history.denied ? (
        <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
          <EyeOff size={14} className="text-gray-400" aria-hidden="true" />
          Turn on access history to see coarse scan activity here.
        </p>
      ) : history.hasEntries ? (
        <ul role="list" id={listId} className="mt-3 space-y-2">
          {history.entries.map((entry, index) => (
            <li
              key={`${entry.bucket ?? 'unknown'}-${index}`}
              role="listitem"
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-medium text-gray-800">{entry.bucketLabel}</span>
              <span
                className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-xs font-bold"
                aria-label={entry.regionAvailable ? `Region: ${entry.region}` : 'Region not recorded'}
              >
                <MapPin size={12} aria-hidden="true" />
                {entry.regionAvailable ? entry.region : 'Region not recorded'}
              </span>
            </li>
          ))}
        </ul>
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
