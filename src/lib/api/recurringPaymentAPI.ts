/**
 * RecurringPaymentAPI
 *
 * Responsibility: Client transport layer between the frontend and PetChain backend
 * for recurring Stellar payment intents, spending caps, next execution times,
 * authorization checks, and cancellation before signing.
 *
 * Authorization and consent decisions are strictly owned by the backend.
 * Secret keys or signing logic NEVER pass through this layer.
 */

import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';
import type {
  RecurringPaymentIntent,
  RecurringPaymentCancellationResponse,
  RecurringPaymentReviewConsentResponse,
} from '../../types/recurringPayment';

class RecurringPaymentManagementAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/payments/recurring`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const legacy = localStorage.getItem('authToken');
        if (legacy) {
          config.headers.Authorization = `Bearer ${legacy}`;
          return config;
        }
        try {
          const stored = localStorage.getItem('auth_tokens');
          const { accessToken } = stored ? JSON.parse(stored) : {};
          if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
        } catch {
          // unauthenticated request
        }
      }
      return config;
    });

    attachCorrelationInterceptor(this.api);
  }

  /**
   * Fetch recurring payment intents for a source Stellar wallet.
   */
  async getRecurringIntents(sourcePublicKey: string): Promise<RecurringPaymentIntent[]> {
    const response = await this.api.get<RecurringPaymentIntent[]>('/', {
      params: { sourcePublicKey },
    });
    return response.data;
  }

  /**
   * Fetch a single recurring payment intent by ID.
   */
  async getIntentById(intentId: string): Promise<RecurringPaymentIntent> {
    const response = await this.api.get<RecurringPaymentIntent>(`/${intentId}`);
    return response.data;
  }

  /**
   * Request backend consent / authorization check for a recurring payment intent before signing.
   * Authorization decisions are exclusively owned and validated by the backend.
   */
  async recordConsentDecision(
    intentId: string,
    action: 'grant' | 'deny'
  ): Promise<RecurringPaymentReviewConsentResponse> {
    const response = await this.api.post<RecurringPaymentReviewConsentResponse>(
      `/${intentId}/consent`,
      { action }
    );
    return response.data;
  }

  /**
   * Cancel an upcoming recurring payment intent before any subsequent transaction is signed.
   */
  async cancelRecurringIntent(intentId: string, reason?: string): Promise<RecurringPaymentCancellationResponse> {
    const response = await this.api.post<RecurringPaymentCancellationResponse>(
      `/${intentId}/cancel`,
      { reason }
    );
    return response.data;
  }
}

export const recurringPaymentAPI = new RecurringPaymentManagementAPI();
export default recurringPaymentAPI;
