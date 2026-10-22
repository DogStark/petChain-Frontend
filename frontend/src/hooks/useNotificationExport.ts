import { useCallback, useMemo, useState } from 'react';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'suppressed';

export interface NotificationExportRow {
  type: string;
  deliveryStatus: NotificationDeliveryStatus;
  timestamp: string;
}

export interface NotificationExportRange {
  from: string;
  to: string;
}

export interface NotificationExportResult {
  rows: NotificationExportRow[];
  denied: boolean;
  empty: boolean;
}

export interface UseNotificationExportOptions {
  /**
   * Fetches the export from the backend. Authorization and consent decisions
   * are owned by the backend; this hook only surfaces the outcome.
   */
  fetchExport?: (
    range: NotificationExportRange,
  ) => Promise<NotificationExportResult>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidRange(range: NotificationExportRange): boolean {
  if (!ISO_DATE.test(range.from) || !ISO_DATE.test(range.to)) {
    return false;
  }
  return range.from <= range.to;
}

function toCsv(rows: NotificationExportRow[]): string {
  const header = 'type,delivery_status,timestamp';
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const lines = rows.map((row) =>
    [row.type, row.deliveryStatus, row.timestamp].map(escape).join(','),
  );
  return [header, ...lines].join('\n');
}

export function useNotificationExport(
  options: UseNotificationExportOptions = {},
) {
  const [range, setRange] = useState<NotificationExportRange>({
    from: '',
    to: '',
  });
  const [rows, setRows] = useState<NotificationExportRow[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'denied' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);

  const rangeValid = useMemo(() => isValidRange(range), [range]);

  const updateRange = useCallback(
    (next: Partial<NotificationExportRange>) => {
      setRange((prev) => ({ ...prev, ...next }));
    },
    [],
  );

  const exportHistory = useCallback(async () => {
    if (!isValidRange(range)) {
      setError('Select a valid date range (start on or before end).');
      setStatus('error');
      return;
    }
    if (!options.fetchExport) {
      setError('Export is not available.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const result = await options.fetchExport(range);
      if (result.denied) {
        setRows([]);
        setStatus('denied');
        return;
      }
      setRows(result.rows);
      setStatus(result.empty || result.rows.length === 0 ? 'success' : 'success');
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error ? err.message : 'Unable to export notifications.',
      );
      setStatus('error');
    }
  }, [options, range]);

  const downloadCsv = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notification-history-${range.from}_${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, range]);

  return {
    range,
    rangeValid,
    rows,
    status,
    error,
    isEmpty: status === 'success' && rows.length === 0,
    isDenied: status === 'denied',
    updateRange,
    exportHistory,
    downloadCsv,
  };
}
