'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Notification history export for account owners.
 *
 * Privacy by default: only notification type, delivery status, and timestamp
 * are exported. Message bodies/secrets and health details are never included
 * in the client-side export. Authorization and consent decisions are owned by
 * the backend — this page only requests the history the backend is willing to
 * return and surfaces denied/empty states without making those decisions.
 */

type DeliveryStatus = 'delivered' | 'pending' | 'failed' | 'suppressed';

interface NotificationHistoryEntry {
  id: string;
  type: string;
  status: DeliveryStatus;
  timestamp: string;
}

interface NotificationHistoryResponse {
  entries: NotificationHistoryEntry[];
}

const EXPORT_COLUMNS = ['type', 'status', 'timestamp'] as const;

function toCsv(entries: NotificationHistoryEntry[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const rows = entries.map((entry) =>
    EXPORT_COLUMNS.map((column) => {
      const value = String(entry[column] ?? '');
      // Escape values containing commas, quotes, or newlines.
      if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','),
  );
  return [header, ...rows].join('\n');
}

function isValidRange(from: string, to: string): boolean {
  if (!from || !to) return false;
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return false;
  return fromTime <= toTime;
}

export default function NotificationsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState<NotificationHistoryEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const rangeValid = useMemo(() => isValidRange(from, to), [from, to]);

  const loadHistory = useCallback(async () => {
    if (!rangeValid) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/notifications/history?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (response.status === 401 || response.status === 403) {
        // Backend owns the authorization/consent decision.
        setEntries([]);
        setStatus('denied');
        return;
      }

      if (!response.ok) {
        setEntries([]);
        setStatus('error');
        setErrorMessage('Unable to load notification history. Please try again.');
        return;
      }

      const data = (await response.json()) as NotificationHistoryResponse;
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setStatus('ready');
    } catch {
      setEntries([]);
      setStatus('error');
      setErrorMessage('Unable to load notification history. Please try again.');
    }
  }, [from, to, rangeValid]);

  const handleExport = useCallback(() => {
    if (entries.length === 0) return;
    const csv = toCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notification-history-${from}_to_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [entries, from, to]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Notification history</h1>
      <p className="mt-2 text-sm text-gray-600">
        Export notification type, delivery status, and timestamp for a date range.
        Message contents and health details are excluded from the export.
      </p>

      <form
        className="mt-6 flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void loadHistory();
        }}
        aria-describedby="export-range-help"
      >
        <div className="flex flex-col">
          <label htmlFor="export-from" className="text-sm font-medium">
            From
          </label>
          <input
            id="export-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="export-to" className="text-sm font-medium">
            To
          </label>
          <input
            id="export-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <button
          type="submit"
          disabled={!rangeValid || status === 'loading'}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {status === 'loading' ? 'Loading…' : 'Load history'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={entries.length === 0}
          className="rounded border border-blue-600 px-4 py-2 text-blue-600 disabled:opacity-50"
        >
          Export CSV
        </button>
      </form>

      <p id="export-range-help" className="mt-2 text-xs text-gray-500">
        Select a start and end date. The end date must be on or after the start date.
      </p>

      <div className="mt-6" role="status" aria-live="polite">
        {status === 'denied' && (
          <p className="text-sm text-red-600">
            You do not have access to export notification history for this account.
          </p>
        )}
        {status === 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}
        {status === 'ready' && entries.length === 0 && (
          <p className="text-sm text-gray-600">No notifications found for the selected range.</p>
        )}
      </div>

      {entries.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <caption className="sr-only">Notification history for the selected date range</caption>
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="py-2">Type</th>
              <th scope="col" className="py-2">Status</th>
              <th scope="col" className="py-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100">
                <td className="py-2">{entry.type}</td>
                <td className="py-2">{entry.status}</td>
                <td className="py-2">{entry.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
