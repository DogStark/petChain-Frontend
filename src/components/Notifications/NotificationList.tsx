import React from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationItem } from './NotificationItem';
import { BellOff, Loader2, CheckCheck } from 'lucide-react';
import styles from './NotificationList.module.css';

export const NotificationList: React.FC = () => {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

  const handleActionClick = (url: string) => {
    window.location.href = url;
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className={styles.centered}>
        <Loader2 className={styles.spinner} size={32} />
        <p>Loading notifications...</p>
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
          <button className={styles.markAllBtn} onClick={markAllRead}>
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
            <p>We&apos;ll notify you when there&apos;s something new.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markRead}
              onActionClick={handleActionClick}
            />
          ))
        )}
      </div>
    </div>
  );
};
