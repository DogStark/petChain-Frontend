export type NotificationCategory =
  | 'APPOINTMENT'
  | 'MEDICATION'
  | 'VACCINATION'
  | 'ALERT'
  | 'MESSAGE'
  | 'MEDICAL_RECORD'
  | 'LOST_PET'
  | 'CONSULTATION'
  | 'SYSTEM';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AppNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// A toast is a transient in-app notification (may or may not be persisted)
export interface ToastNotification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms, 0 = sticky
  actionLabel?: string;
  onAction?: () => void;
}

export interface NotificationPreferences {
  // Channels
  sound: boolean;
  vibration: boolean;
  browserPush: boolean;
  // DND
  doNotDisturb: boolean;
  dndStart: string; // "HH:MM"
  dndEnd: string;   // "HH:MM"
  // Category toggles
  categories: Record<NotificationCategory, boolean>;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  sound: true,
  vibration: true,
  browserPush: false,
  doNotDisturb: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  categories: {
    APPOINTMENT: true,
    MEDICATION: true,
    VACCINATION: true,
    ALERT: true,
    MESSAGE: true,
    MEDICAL_RECORD: true,
    LOST_PET: true,
    CONSULTATION: true,
    SYSTEM: true,
  },
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  APPOINTMENT: 'Appointments',
  MEDICATION: 'Medications',
  VACCINATION: 'Vaccinations',
  ALERT: 'Alerts',
  MESSAGE: 'Messages',
  MEDICAL_RECORD: 'Medical Records',
  LOST_PET: 'Lost Pet',
  CONSULTATION: 'Consultations',
  SYSTEM: 'System',
};

export const CATEGORY_ICONS: Record<NotificationCategory, string> = {
  APPOINTMENT: '📅',
  MEDICATION: '💊',
  VACCINATION: '💉',
  ALERT: '⚠️',
  MESSAGE: '💬',
  MEDICAL_RECORD: '📋',
  LOST_PET: '🔍',
  CONSULTATION: 'ℹ️',
  SYSTEM: '🔔',
};
