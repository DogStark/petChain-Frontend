import React, { useState, useEffect, useCallback } from 'react';
import { NotificationItem } from './NotificationItem';
import { notificationsAPI, Notification } from '../../lib/api/notificationsAPI';
import { BellOff, Loader2, CheckCheck } from 'lucide-react';
import styles from './NotificationList.module.css';

interface NotificationListProps {
  userId: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await notificationsAPI.getNotifications(userId);
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(userId, id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleActionClick = (url: string) => {
    window.location.href = url;
  };

  if (loading && notifications.length === 0) {
    return (
      <div className={styles.centered}>
        <Loader2 className={styles.spinner} size={32} />
        <p>Loading notifications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className={styles.error}>{error}</p>
        <button className={styles.retryBtn} onClick={fetchNotifications}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Notifications</h2>
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount} unread</span>}
        </div>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={handleMarkAllAsRead}>
            <CheckCheck size={16} className={styles.btnIcon} />
            Mark all as read
          </button>
        )}
      </div>

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>
            <BellOff size={48} className={styles.emptyIcon} />
            <h3>No notifications yet</h3>
            <p>We'll notify you when there's something new.</p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationItem 
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onActionClick={handleActionClick}
            />
          ))
        )}
      </div>
    </div>
  );
};
