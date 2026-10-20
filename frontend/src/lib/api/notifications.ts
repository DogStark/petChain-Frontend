import { apiClient } from './client';

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
