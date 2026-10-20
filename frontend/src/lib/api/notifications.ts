import { apiClient } from './client';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'suppressed';

export interface NotificationHistoryExportParams {
  /** Inclusive ISO date (YYYY-MM-DD) lower bound. */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound. */
  to: string;
}

export interface NotificationHistoryExportRow {
  type: string;
  deliveryStatus: NotificationDeliveryStatus;
  timestamp: string;
}

export interface NotificationHistoryExportResult {
  rows: NotificationHistoryExportRow[];
  /** True when the backend withheld fields for privacy/consent reasons. */
  redacted: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Invalid ${field} date: expected YYYY-MM-DD`);
  }
}

/**
 * Request a date-bounded notification history export for the current account.
 *
 * Only notification type, delivery status, and timestamp are requested. Message
 * secrets and health details are excluded by default; the backend owns all
 * authorization and consent decisions and may redact or deny the request.
 */
export async function exportNotificationHistory(
  params: NotificationHistoryExportParams,
): Promise<NotificationHistoryExportResult> {
  assertIsoDate(params.from, 'from');
  assertIsoDate(params.to, 'to');

  if (params.from > params.to) {
    throw new Error('Invalid date range: from must be on or before to');
  }

  const response = await apiClient.get<NotificationHistoryExportResult>(
    '/notifications/history/export',
    {
      params: {
        from: params.from,
        to: params.to,
        fields: 'type,deliveryStatus,timestamp',
        includeSecrets: false,
        includeHealthDetails: false,
      },
    },
  );

  return response.data;
}
