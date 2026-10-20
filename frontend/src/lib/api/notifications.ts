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

/** Clinical domains whose push actions require a review step. */
export type ClinicalActionDomain = 'medication' | 'appointment';

export interface NotificationActionReview {
  notificationId: string;
  domain: ClinicalActionDomain;
  /** Human-readable summary of the change the action would apply. */
  summary: string;
  /** Server version of the notification the review was based on. */
  version: string;
}

export interface NotificationActionConfirmation {
  notificationId: string;
  domain: ClinicalActionDomain;
  /** Version the user reviewed; the backend rejects stale confirmations. */
  version: string;
}

export type NotificationActionOutcome =
  | { status: 'applied'; version: string }
  | { status: 'stale'; current: NotificationActionReview }
  | { status: 'denied'; reason?: string };

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

/**
 * Fetch the review payload for a push action that would change medication or
 * appointment state. The backend owns authorization and consent decisions and
 * may deny the request.
 */
export async function fetchNotificationActionReview(
  notificationId: string,
): Promise<NotificationActionReview> {
  const response = await apiClient.get<NotificationActionReview>(
    `/notifications/${encodeURIComponent(notificationId)}/action/review`,
  );

  return response.data;
}

/**
 * Confirm a reviewed clinical action. The reviewed version is sent so the
 * backend can reject stale confirmations; a `stale` outcome carries the
 * current server state so the caller can route the user to it.
 */
export async function confirmNotificationAction(
  confirmation: NotificationActionConfirmation,
): Promise<NotificationActionOutcome> {
  const response = await apiClient.post<NotificationActionOutcome>(
    `/notifications/${encodeURIComponent(confirmation.notificationId)}/action/confirm`,
    {
      domain: confirmation.domain,
      version: confirmation.version,
    },
  );

  return response.data;
}
