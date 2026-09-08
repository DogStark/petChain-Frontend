import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from './api/apiBaseUrl';

export type ConsentType = 'marketing' | 'analytics' | 'data_sharing' | 'essential';

export interface UserConsent {
  id: string;
  userId: string;
  type: ConsentType;
  granted: boolean;
  updatedAt: string;
}

export type DeletionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface DeletionRequest {
  id: string;
  userId: string;
  status: DeletionStatus;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Statuses that represent an in-flight erasure request that must not be duplicated. */
export const ACTIVE_DELETION_STATUSES: DeletionStatus[] = ['pending', 'processing'];

/** Extracts a user-facing message from a failed GDPR request, including auth failures. */
export function getGdprErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (serverMessage) return serverMessage;
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

class GdprAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/gdpr`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;

    const legacyToken = localStorage.getItem('authToken');
    if (legacyToken) return legacyToken;

    const storedTokens = localStorage.getItem('auth_tokens');
    if (!storedTokens) return null;

    try {
      const parsed = JSON.parse(storedTokens);
      return parsed?.accessToken ?? null;
    } catch {
      return null;
    }
  }

  async getConsents(userId: string): Promise<UserConsent[]> {
    const response = await this.api.get(`/users/${userId}/consents`);
    return response.data;
  }

  async updateConsent(userId: string, type: ConsentType, granted: boolean): Promise<UserConsent> {
    const response = await this.api.patch(`/users/${userId}/consents`, { type, granted });
    return response.data;
  }

  async initConsents(userId: string): Promise<UserConsent[]> {
    const response = await this.api.post(`/users/${userId}/consents/init`);
    return response.data;
  }

  async requestDeletion(userId: string, reason?: string): Promise<DeletionRequest> {
    const response = await this.api.post(`/users/${userId}/deletion-request`, { reason });
    return response.data;
  }

  async cancelDeletion(userId: string): Promise<DeletionRequest> {
    const response = await this.api.delete(`/users/${userId}/deletion-request`);
    return response.data;
  }

  async getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
    try {
      const response = await this.api.get(`/users/${userId}/deletion-status`);
      return response.data ?? null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async exportData(userId: string): Promise<void> {
    const response = await this.api.get(`/users/${userId}/export`, { responseType: 'blob' });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petchain-data-${userId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const gdprService = new GdprAPI();

export type { AxiosError };
