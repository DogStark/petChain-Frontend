import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

export interface TwoFactorSetupResponse {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

export interface TwoFactorStatusResponse {
  isEnabled: boolean;
  backupCodesCount: number;
}

class TwoFactorAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/auth/2fa`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async getStatus(): Promise<TwoFactorStatusResponse> {
    const response = await this.api.get('/status');
    return response.data;
  }

  async setup(): Promise<TwoFactorSetupResponse> {
    const response = await this.api.post('/setup');
    return response.data;
  }

  async enable(totpToken: string): Promise<{ backupCodes: string[] }> {
    const response = await this.api.post('/enable', { token: totpToken });
    return response.data;
  }

  async disable(totpToken: string): Promise<void> {
    await this.api.post('/disable', { token: totpToken });
  }

  async verify(email: string, password: string, totpToken: string) {
    const response = await this.api.post('/verify', { email, password, token: totpToken });
    return response.data;
  }

  async generateBackupCodes(): Promise<{ backupCodes: string[] }> {
    const response = await this.api.post('/backup-codes');
    return response.data;
  }

  async recover(email: string, password: string, backupCode: string) {
    const response = await this.api.post('/recover', { email, password, backupCode });
    return response.data;
  }
}

export const twoFactorAPI = new TwoFactorAPI();
