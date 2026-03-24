import React from 'react';
import { formatDistanceToNow } from 'date-fns';
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
  ExternalLink
} from 'lucide-react';
import styles from './NotificationItem.module.css';

export interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    message: string;
    category: string;
    isRead: boolean;
    createdAt: string;
    actionUrl?: string | null;
    metadata?: any;
  };
  onMarkAsRead: (id: string) => void;
  onActionClick?: (url: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'APPOINTMENT': return <Calendar size={20} />;
    case 'MEDICATION': return <Syringe size={20} />;
    case 'CONSULTATION': return <Info size={20} />;
    case 'ALERT': return <AlertTriangle size={20} />;
    case 'MESSAGE': return <MessageSquare size={20} />;
    case 'VACCINATION': return <Syringe size={20} />;
    case 'LOST_PET': return <Search size={20} />;
    case 'MEDICAL_RECORD': return <FileText size={20} />;
    default: return <Bell size={20} />;
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onActionClick,
}) => {
  const { 
    id, 
    title, 
    message, 
    category, 
    isRead, 
    createdAt, 
    actionUrl, 
    metadata 
  } = notification;

  const date = new Date(createdAt);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionUrl && onActionClick) {
      onActionClick(actionUrl);
    }
  };

  return (
    <div 
      className={`${styles.container} ${!isRead ? styles.unread : ''}`}
      onClick={() => !isRead && onMarkAsRead(id)}
    >
      <div className={`${styles.iconContainer} ${styles[category.toLowerCase()] || styles.default}`}>
        {getCategoryIcon(category)}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h4 className={styles.title}>{title}</h4>
          <span className={styles.time}>{timeAgo}</span>
        </div>
        <p className={styles.message}>{message}</p>

        {/* Rich Notification: Image Display */}
        {metadata?.imageUrl && (
          <div className={styles.imageContainer}>
            <img src={metadata.imageUrl} alt="Notification attachment" className={styles.image} />
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actions}>
          {actionUrl && (
            <button 
              className={styles.actionBtn} 
              onClick={handleAction}
            >
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
        </div>
      </div>

      {!isRead && <div className={styles.unreadDot} />}
    </div>
  );
};
