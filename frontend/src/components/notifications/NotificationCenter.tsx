import React, { useMemo, useState } from 'react';

export interface NotificationRecord {
  id: string;
  petId?: string | null;
  petName?: string | null;
  topic?: string | null;
  title: string;
  body?: string | null;
  read: boolean;
  deepLink?: string | null;
  createdAt?: string | null;
}

interface NotificationCenterProps {
  notifications: NotificationRecord[];
  onMarkRead?: (id: string) => void;
  onOpen?: (notification: NotificationRecord) => void;
}

interface NotificationGroup {
  key: string;
  petLabel: string;
  topicLabel: string;
  items: NotificationRecord[];
}

const UNKNOWN_PET = 'General';
const UNKNOWN_TOPIC = 'Other';

function groupNotifications(notifications: NotificationRecord[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const notification of notifications) {
    const petLabel = notification.petName?.trim() || UNKNOWN_PET;
    const topicLabel = notification.topic?.trim() || UNKNOWN_TOPIC;
    const key = `${notification.petId ?? 'none'}::${topicLabel.toLowerCase()}`;

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(notification);
    } else {
      groups.set(key, { key, petLabel, topicLabel, items: [notification] });
    }
  }

  return Array.from(groups.values());
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkRead,
  onOpen,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (notifications.length === 0) {
    return (
      <section aria-label="Notifications" className="notification-center">
        <p role="status" className="notification-center__empty">
          You have no notifications.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Notifications" className="notification-center">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key] ?? false;
        const unreadCount = group.items.filter((item) => !item.read).length;
        const headingId = `notification-group-${group.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

        return (
          <div key={group.key} className="notification-group">
            <h3 className="notification-group__heading">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={`${headingId}-list`}
                onClick={() => toggleGroup(group.key)}
                className="notification-group__toggle"
              >
                <span className="notification-group__label">
                  {group.petLabel} · {group.topicLabel}
                </span>
                <span className="notification-group__count">
                  {unreadCount > 0
                    ? `${unreadCount} unread of ${group.items.length}`
                    : `${group.items.length}`}
                </span>
              </button>
            </h3>
            <ul
              id={`${headingId}-list`}
              hidden={isCollapsed}
              className="notification-group__list"
            >
              {group.items.map((notification) => (
                <li
                  key={notification.id}
                  className={
                    notification.read
                      ? 'notification-item notification-item--read'
                      : 'notification-item notification-item--unread'
                  }
                >
                  <div className="notification-item__content">
                    <span className="notification-item__title">{notification.title}</span>
                    {notification.body ? (
                      <span className="notification-item__body">{notification.body}</span>
                    ) : null}
                    <span className="notification-item__state">
                      {notification.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <div className="notification-item__actions">
                    {notification.deepLink ? (
                      <a
                        href={notification.deepLink}
                        className="notification-item__link"
                        onClick={() => onOpen?.(notification)}
                      >
                        View record
                      </a>
                    ) : null}
                    {!notification.read && onMarkRead ? (
                      <button
                        type="button"
                        className="notification-item__mark-read"
                        onClick={() => onMarkRead(notification.id)}
                        aria-label={`Mark ${notification.title} as read`}
                      >
                        Mark as read
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
};

export default NotificationCenter;
