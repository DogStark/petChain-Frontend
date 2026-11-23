import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Syringe,
  Search,
  FileText,
  Info,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Undo2,
} from 'lucide-react';
import styles from './NotificationItem.module.css';
import type { NotificationMetadata } from '../../types/notification';
import { useSwipe } from '../../hooks/useSwipe';

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
};
export interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    message: string;
    category: string;
    isRead: boolean;
    createdAt: string;
    actionUrl?: string | null;
    metadata?: NotificationMetadata | null;
  };
  onMarkAsRead: (id: string) => void;
  onActionClick?: (url: string) => void;
  onDelete?: (id: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'APPOINTMENT':
      return <Calendar size={20} />;
    case 'MEDICATION':
      return <Syringe size={20} />;
    case 'CONSULTATION':
      return <Info size={20} />;
    case 'ALERT':
      return <AlertTriangle size={20} />;
    case 'MESSAGE':
      return <MessageSquare size={20} />;
    case 'VACCINATION':
      return <Syringe size={20} />;
    case 'LOST_PET':
      return <Search size={20} />;
    case 'MEDICAL_RECORD':
      return <FileText size={20} />;
    default:
      return <Bell size={20} />;
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onActionClick,
  onDelete,
}) => {
  const { id, title, message, category, isRead, createdAt, actionUrl, metadata } = notification;

  const date = new Date(createdAt);
  const timeAgo = formatTimeAgo(date);

  const [isDeleted, setIsDeleted] = useState(false);
  const [showUndo, setShowUndo] = useState(false);

  const handleDelete = () => {
    if (!onDelete || isDeleted) return;
    setIsDeleted(true);
    setShowUndo(true);
    onDelete(id);
  };

  const { offset, isDragging, isRevealed, reset, handlers } = useSwipe({
    onSwipeLeft: handleDelete,
  });

  useEffect(() => {
    if (!showUndo) return;
    const timer = setTimeout(() => setShowUndo(false), 5000);
    return () => clearTimeout(timer);
  }, [showUndo]);

  const handleUndo = () => {
    setIsDeleted(false);
    setShowUndo(false);
    reset();
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionUrl && onActionClick) {
      onActionClick(actionUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
      e.preventDefault();
      handleDelete();
    }
  };

  if (isDeleted) {
    return (
      <div className={styles.container} role="status" aria-live="polite">
        <div className={styles.content}>
          <p className={styles.message}>Notification deleted.</p>
          {showUndo && (
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleUndo}>
                <Undo2 size={14} className={styles.btnIcon} />
                Undo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.swipeWrapper}>
      {onDelete && (
        <button
          type="button"
          className={styles.deleteAction}
          aria-label={`Delete notification: ${title}`}
          aria-hidden={!isRevealed}
          tabIndex={isRevealed ? 0 : -1}
          onClick={handleDelete}
        >
          <Trash2 size={18} />
          Delete
        </button>
      )}
      <div
        className={`${styles.container} ${!isRead ? styles.unread : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
        }}
        onClick={() => !isRead && onMarkAsRead(id)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${title}. ${isRead ? 'Read' : 'Unread'} notification. Press Delete to remove.`}
        {...handlers}
      >
        <div
          className={`${styles.iconContainer} ${styles[category.toLowerCase()] || styles.default}`}
        >
          {getCategoryIcon(category)}
        </div>

        <div className={styles.content}>
          <div className={styles.header}>
            <h4 className={styles.title}>{title}</h4>
            <span className={styles.time}>{timeAgo}</span>
          </div>
          <p className={styles.message}>{message}</p>

          {/* Rich Notification: Image Display */}
          {metadata && 'imageUrl' in metadata && metadata.imageUrl && (
            <div className={styles.imageContainer}>
              <img src={metadata.imageUrl} alt="Notification attachment" className={styles.image} loading="lazy" width={300} height={200} />
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>
            {actionUrl && (
              <button className={styles.actionBtn} onClick={handleAction}>
                <ExternalLink size={14} className={styles.btnIcon} />
                View Details
              </button>
            )}

            {!isRead && (
              <button
                className={styles.markReadBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(id);
                }}
              >
                <CheckCircle2 size={14} className={styles.btnIcon} />
                Mark as read
              </button>
            )}

            {onDelete && (
              <button
                className={styles.markReadBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                aria-label={`Delete notification: ${title}`}
              >
                <Trash2 size={14} className={styles.btnIcon} />
                Delete
              </button>
            )}
          </div>
        </div>

        {!isRead && <div className={styles.unreadDot} />}
      </div>
    </div>
  );
};
