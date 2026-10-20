import { useCallback, useId, useMemo, useState } from 'react';

export interface NotificationHistoryExportRow {
  type: string;
  deliveryStatus: string;
  timestamp: string;
}

export interface NotificationHistoryExportProps {
  /**
   * Fetches the export for the given inclusive date range.
   * Authorization and consent are decided by the backend; the frontend only
   * forwards the requested range and renders whatever the backend returns.
   */
  onExport: (range: { from: string; to: string }) => Promise<NotificationHistoryExportRow[]>;
}

function toCsv(rows: NotificationHistoryExportRow[]): string {
  const header = ['type', 'deliveryStatus', 'timestamp'];
  const escape = (value: string) => {
    const safe = value ?? '';
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((row) =>
    [row.type, row.deliveryStatus, row.timestamp].map(escape).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function NotificationHistoryExport({ onExport }: NotificationHistoryExportProps) {
  const fromId = useId();
  const toId = useId();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<NotificationHistoryExportRow[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'denied'>('idle');
  const [message, setMessage] = useState('');

  const rangeInvalid = useMemo(() => Boolean(from && to && from > to), [from, to]);
  const canExport = Boolean(from && to) && !rangeInvalid && status !== 'loading';

  const handleExport = useCallback(async () => {
    if (!from || !to || rangeInvalid) {
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const result = await onExport({ from, to });
      setRows(result);
      setStatus('idle');
      setMessage(
        result.length === 0
          ? 'No notifications found in the selected range.'
          : `Exported ${result.length} notification${result.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      const denied =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status?: number }).status === 403;
      setRows(null);
      setStatus(denied ? 'denied' : 'error');
      setMessage(
        denied
          ? 'You do not have permission to export this notification history.'
          : 'Unable to export notification history. Please try again.',
      );
    }
  }, [from, to, rangeInvalid, onExport]);

  const handleDownload = useCallback(() => {
    if (!rows || rows.length === 0) {
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notification-history-${from}_to_${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, from, to]);

  return (
    <section aria-labelledby="notification-history-export-heading">
      <h2 id="notification-history-export-heading">Export notification history</h2>
      <p>
        Export notification type, delivery status, and timestamp for a date range. Message
        contents and health details are excluded by default.
      </p>

      <div>
        <label htmlFor={fromId}>From</label>
        <input
          id={fromId}
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => setFrom(event.target.value)}
          aria-describedby={rangeInvalid ? 'notification-history-export-error' : undefined}
        />
      </div>

      <div>
        <label htmlFor={toId}>To</label>
        <input
          id={toId}
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setTo(event.target.value)}
          aria-describedby={rangeInvalid ? 'notification-history-export-error' : undefined}
        />
      </div>

      {rangeInvalid && (
        <p id="notification-history-export-error" role="alert">
          The start date must be on or before the end date.
        </p>
      )}

      <button type="button" onClick={handleExport} disabled={!canExport}>
        {status === 'loading' ? 'Exporting…' : 'Export'}
      </button>

      {rows && rows.length > 0 && (
        <button type="button" onClick={handleDownload}>
          Download CSV
        </button>
      )}

      <p role="status" aria-live="polite">
        {message}
      </p>

      {rows && rows.length > 0 && (
        <table>
          <caption>Notification history for the selected range</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Delivery status</th>
              <th scope="col">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.timestamp}-${index}`}>
                <td>{row.type}</td>
                <td>{row.deliveryStatus}</td>
                <td>{row.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default NotificationHistoryExport;
