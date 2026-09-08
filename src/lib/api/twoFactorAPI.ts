import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { ApiError } from '../apiError';

export interface TwoFactorSetupResponse {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

export interface TwoFactorStatusResponse {
  isEnabled: boolean;
  backupCodesCount: number;
}

/** Shared response shape for /auth/2fa/verify and /auth/2fa/recover. */
export interface TwoFactorAuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    isVerified: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

/** Rethrows any failed request as a localized ApiError with the given fallback key/message. */
function wrapError(key: string, fallbackMessage: string) {
  return (error: unknown): never => {
    if (error instanceof ApiError) throw error;
    throw new ApiError(key, fallbackMessage);
  };
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
    const response = await this.api
      .get('/status')
      .catch(wrapError('errors.twoFactor.statusFailed', 'Failed to get 2FA status'));
    return response.data;
  }

  async setup(): Promise<TwoFactorSetupResponse> {
    const response = await this.api
      .post('/setup')
      .catch(wrapError('errors.twoFactor.setupFailed', 'Failed to setup 2FA'));
    return response.data;
  }

  async enable(totpToken: string): Promise<{ backupCodes: string[] }> {
    const response = await this.api
      .post('/enable', { token: totpToken })
      .catch(wrapError('errors.twoFactor.enableFailed', 'Failed to enable 2FA'));
    return response.data;
  }

  async disable(totpToken: string): Promise<void> {
    await this.api
      .post('/disable', { token: totpToken })
      .catch(wrapError('errors.twoFactor.disableFailed', 'Failed to disable 2FA'));
  }

  async verify(email: string, password: string, totpToken: string): Promise<TwoFactorAuthResponse> {
    const response = await this.api
      .post<TwoFactorAuthResponse>('/verify', { email, password, token: totpToken })
      .catch(wrapError('errors.twoFactor.invalidToken', 'Invalid 2FA token'));
    return response.data;
  }

  async generateBackupCodes(totpToken?: string): Promise<{ backupCodes: string[] }> {
    const response = await this.api
      .post('/backup-codes', totpToken ? { token: totpToken } : {})
      .catch(wrapError('errors.twoFactor.backupCodesFailed', 'Failed to generate backup codes'));
    return response.data;
  }

  async recover(email: string, password: string, backupCode: string): Promise<TwoFactorAuthResponse> {
    const response = await this.api
      .post<TwoFactorAuthResponse>('/recover', { email, password, backupCode })
      .catch(wrapError('errors.twoFactor.invalidBackupCode', 'Invalid backup code'));
    return response.data;
  }
}

export const twoFactorAPI = new TwoFactorAPI();
