import { useCallback, useMemo, useState } from 'react';

export interface NotificationRecord {
  id: string;
  petId?: string | null;
  petName?: string | null;
  topic?: string | null;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationGroup {
  key: string;
  petId: string | null;
  petName: string | null;
  topic: string | null;
  notifications: NotificationRecord[];
  unreadCount: number;
}

const UNGROUPED_KEY = 'ungrouped';

function groupKey(notification: NotificationRecord): string {
  const pet = notification.petId ?? 'no-pet';
  const topic = notification.topic ?? 'no-topic';
  return `${pet}::${topic}`;
}

export function groupNotifications(
  notifications: NotificationRecord[],
): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const notification of notifications) {
    const key = groupKey(notification);
    const existing = groups.get(key);
    if (existing) {
      existing.notifications.push(notification);
      if (!notification.read) {
        existing.unreadCount += 1;
      }
    } else {
      groups.set(key, {
        key,
        petId: notification.petId ?? null,
        petName: notification.petName ?? null,
        topic: notification.topic ?? null,
        notifications: [notification],
        unreadCount: notification.read ? 0 : 1,
      });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    notifications: [...group.notifications].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  }));
}

export interface UseNotificationsResult {
  notifications: NotificationRecord[];
  groups: NotificationGroup[];
  unreadCount: number;
  markRead: (id: string) => void;
  markGroupRead: (groupKey: string) => void;
}

export function useNotifications(
  initialNotifications: NotificationRecord[] = [],
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(
    initialNotifications,
  );

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id && !notification.read
          ? { ...notification, read: true }
          : notification,
      ),
    );
  }, []);

  const markGroupRead = useCallback((key: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        groupKey(notification) === key && !notification.read
          ? { ...notification, read: true }
          : notification,
      ),
    );
  }, []);

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, n) => (n.read ? count : count + 1), 0),
    [notifications],
  );

  return { notifications, groups, unreadCount, markRead, markGroupRead };
}

export { UNGROUPED_KEY };
