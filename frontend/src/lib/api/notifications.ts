import { apiClient } from './client';

export type NotificationChannel = 'push' | 'email' | 'in_app';

export type NotificationEventType =
  | 'care_reminder'
  | 'appointment'
  | 'medication'
  | 'security';

export interface NotificationChannelPreference {
  channel: NotificationChannel;
  enabled: boolean;
  /** Backend-owned: true when this channel cannot be disabled for this event. */
  locked: boolean;
  /** Backend-owned reason shown to the user when locked (e.g. security notice). */
  lockedReason?: string;
}

export interface PetNotificationPreference {
  petId: string;
  eventType: NotificationEventType;
  channels: NotificationChannelPreference[];
}

export interface PetNotificationPreferencesResponse {
  petId: string;
  preferences: PetNotificationPreference[];
}

export interface UpdatePetNotificationPreferenceInput {
  petId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * Fetch per-pet notification channel preferences.
 * Authorization and consent decisions are owned by the backend; the client
 * only renders what the backend returns.
 */
export async function getPetNotificationPreferences(
  petId: string,
): Promise<PetNotificationPreferencesResponse> {
  return apiRequest<PetNotificationPreferencesResponse>(
    `/pets/${encodeURIComponent(petId)}/notification-preferences`,
    { method: 'GET' },
  );
}

/**
 * Update a single channel preference for a pet and event type.
 * The backend remains the source of truth and may reject or lock channels
 * (e.g. required security notifications).
 */
export async function updatePetNotificationPreference(
  input: UpdatePetNotificationPreferenceInput,
): Promise<PetNotificationPreference> {
  const { petId, eventType, channel, enabled } = input;
  return apiRequest<PetNotificationPreference>(
    `/pets/${encodeURIComponent(petId)}/notification-preferences`,
    {
      method: 'PATCH',
      body: JSON.stringify({ eventType, channel, enabled }),
    },
  );
}

export type NotificationReadState = 'read' | 'unread';

export interface NotificationRecord {
  id: string;
  petId: string | null;
  petName?: string | null;
  topic: string;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  readState: NotificationReadState;
  createdAt: string;
}

export interface NotificationGroup {
  key: string;
  petId: string | null;
  petName: string | null;
  topic: string;
  notifications: NotificationRecord[];
  unreadCount: number;
  latestCreatedAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
}

export async function fetchNotifications(): Promise<NotificationRecord[]> {
  const response = await apiClient.get<NotificationListResponse>('/notifications');
  return response.data.notifications ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${encodeURIComponent(id)}/read`);
}

export function groupNotificationsByPetAndTopic(
  notifications: NotificationRecord[],
): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const notification of notifications) {
    const petKey = notification.petId ?? 'no-pet';
    const key = `${petKey}::${notification.topic}`;
    const existing = groups.get(key);

    if (existing) {
      existing.notifications.push(notification);
      if (notification.readState === 'unread') {
        existing.unreadCount += 1;
      }
      if (notification.createdAt > existing.latestCreatedAt) {
        existing.latestCreatedAt = notification.createdAt;
      }
    } else {
      groups.set(key, {
        key,
        petId: notification.petId,
        petName: notification.petName ?? null,
        topic: notification.topic,
        notifications: [notification],
        unreadCount: notification.readState === 'unread' ? 1 : 0,
        latestCreatedAt: notification.createdAt,
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      notifications: [...group.notifications].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      ),
    }))
    .sort((a, b) =>
      a.latestCreatedAt < b.latestCreatedAt
        ? 1
        : a.latestCreatedAt > b.latestCreatedAt
          ? -1
          : 0,
    );
}

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
}
