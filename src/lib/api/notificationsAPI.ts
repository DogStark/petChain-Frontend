import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';
import type {
  AppNotification,
  NotificationCategory,
  NotificationPreferences,
} from '@/types/notification';
export type { NotificationCategory, NotificationPriority } from '@/types/notification';

export interface NotificationQuery {
  category?: NotificationCategory;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Notification = Omit<AppNotification, 'metadata'> & {
  userId: string;
  metadata: unknown;
};

export interface RegisterDeviceTokenDto {
  token: string;
  platform?: string;
}

// Supported locales for email notification templates.
export type NotificationLocale =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'ar';

export const NOTIFICATION_LOCALES: { value: NotificationLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'ar', label: 'العربية' },
];

export interface EmailTemplatePreview {
  locale: NotificationLocale;
  subject: string;
  body: string;
}

// The backend's notification_settings table only stores per-category
// booleans (+ a global switch) — it has no columns for sound/vibration/
// browserPush/DND, which stay client-only (localStorage). This maps
// between that DTO and the frontend's NotificationPreferences.categories.
export interface NotificationSettingsDto {
  globalEnabled?: boolean;
  appointment?: boolean;
  medication?: boolean;
  consultation?: boolean;
  alert?: boolean;
  message?: boolean;
  vaccination?: boolean;
  lostPet?: boolean;
  medicalRecord?: boolean;
  system?: boolean;
  emailLocale?: NotificationLocale;
}

const CATEGORY_TO_SETTINGS_FIELD: Record<
  keyof NotificationPreferences['categories'],
  keyof Omit<NotificationSettingsDto, 'globalEnabled' | 'emailLocale'>
> = {
  APPOINTMENT: 'appointment',
  MEDICATION: 'medication',
  CONSULTATION: 'consultation',
  ALERT: 'alert',
  MESSAGE: 'message',
  VACCINATION: 'vaccination',
  LOST_PET: 'lostPet',
  MEDICAL_RECORD: 'medicalRecord',
  SYSTEM: 'system',
};

function categoriesToSettingsDto(
  categories: NotificationPreferences['categories']
): NotificationSettingsDto {
  const dto: NotificationSettingsDto = {};
  (
    Object.keys(CATEGORY_TO_SETTINGS_FIELD) as (keyof NotificationPreferences['categories'])[]
  ).forEach((category) => {
    dto[CATEGORY_TO_SETTINGS_FIELD[category]] = categories[category];
  });
  return dto;
}

function settingsDtoToCategories(
  dto: NotificationSettingsDto,
  fallback: NotificationPreferences['categories']
): NotificationPreferences['categories'] {
  const categories = { ...fallback };
  (
    Object.keys(CATEGORY_TO_SETTINGS_FIELD) as (keyof NotificationPreferences['categories'])[]
  ).forEach((category) => {
    const value = dto[CATEGORY_TO_SETTINGS_FIELD[category]];
    if (typeof value === 'boolean') categories[category] = value;
  });
  return categories;
}

class NotificationsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/notifications`,
      withCredentials: true,
    });

    attachCorrelationInterceptor(this.api);

    // Add token to requests
    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
  }

  async getNotifications(
    userId: string,
    query: NotificationQuery = {}
  ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const response = await this.api.get(`/${userId}`, { params: query });
    return response.data;
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const response = await this.api.patch(`/${userId}/${notificationId}/read`);
    return response.data;
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const response = await this.api.patch(`/${userId}/read-all`);
    return response.data;
  }

  async registerDeviceToken(userId: string, data: RegisterDeviceTokenDto): Promise<DeviceToken> {
    const response = await this.api.post(`/${userId}/device-tokens`, data);
    return response.data;
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.api.delete(`/${userId}/device-tokens/${token}`);
  }

  /**
   * Fetches the server's category settings and merges them into `fallback`
   * (the locally cached preferences), so client-only fields the backend
   * doesn't store (sound, vibration, browserPush, DND) are preserved.
   */
  async getPreferences(
    userId: string,
    fallback: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const response = await this.api.get<NotificationSettingsDto>(`/${userId}/settings`);
    return {
      ...fallback,
      categories: settingsDtoToCategories(response.data, fallback.categories),
      emailLocale: response.data.emailLocale ?? fallback.emailLocale,
    };
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    await this.api.patch(`/${userId}/settings`, {
      ...categoriesToSettingsDto(preferences.categories),
      emailLocale: preferences.emailLocale,
    });
  }

  /**
   * Persists only the email notification language for the user.
   */
  async updateEmailLocale(userId: string, locale: NotificationLocale): Promise<void> {
    await this.api.patch(`/${userId}/settings`, { emailLocale: locale });
  }

  /**
   * Fetches a rendered preview of the email notification template in the
   * requested locale.
   */
  async getEmailTemplatePreview(
    userId: string,
    locale: NotificationLocale
  ): Promise<EmailTemplatePreview> {
    const response = await this.api.get<EmailTemplatePreview>(
      `/${userId}/settings/email-preview`,
      { params: { locale } }
    );
    return response.data;
  }
}

export const notificationsAPI = new NotificationsAPI();
