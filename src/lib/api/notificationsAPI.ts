import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDeviceTokenDto {
  token: string;
  platform?: string;
}

class NotificationsAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/notifications`,
      withCredentials: true,
    });

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

  async getNotifications(userId: string, query: any = {}): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
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

  async registerDeviceToken(userId: string, data: RegisterDeviceTokenDto): Promise<any> {
    const response = await this.api.post(`/${userId}/device-tokens`, data);
    return response.data;
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.api.delete(`/${userId}/device-tokens/${token}`);
  }
}

export const notificationsAPI = new NotificationsAPI();
