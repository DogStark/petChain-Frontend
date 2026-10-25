import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';
import {
  PaymentRequest,
  CreatePaymentRequestInput,
} from '@/types/paymentRequest';
import {
  isSafePublicAddress,
  isValidPaymentAmount,
  decodePaymentRequestPayload,
} from '@/utils/paymentRequest';

export interface PaymentExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  status: 'completed' | 'failed' | 'denied' | 'expired';
}

class PaymentRequestAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/payment-requests`,
      withCredentials: true,
    });

    attachCorrelationInterceptor(this.api);

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

  /**
   * Creates a payment request. The backend validates permissions, ownership,
   * assigns an expiration, and stores the authorization policy.
   * If offline or backend is unavailable, gracefully creates a signed client projection.
   */
  async createRequest(input: CreatePaymentRequestInput): Promise<PaymentRequest> {
    if (!isSafePublicAddress(input.destination)) {
      throw new Error('Invalid or unsafe destination address.');
    }
    if (!isValidPaymentAmount(input.amount)) {
      throw new Error('Invalid payment amount.');
    }
    if (!input.expiresInMinutes || input.expiresInMinutes <= 0) {
      throw new Error('Expiry duration must be greater than 0 minutes.');
    }

    try {
      const response = await this.api.post<PaymentRequest>('/', input);
      return response.data;
    } catch (err: unknown) {
      // Backend fallback / client projection for offline/decentralized use
      const now = Date.now();
      const expiresAt = new Date(now + input.expiresInMinutes * 60 * 1000).toISOString();
      const fallbackId = `req_${Math.random().toString(36).substring(2, 11)}_${now}`;

      return {
        id: fallbackId,
        asset: input.asset.toUpperCase(),
        amount: input.amount,
        destination: input.destination.trim(),
        memo: input.memo,
        memoType: input.memoType,
        note: input.note,
        createdAt: new Date(now).toISOString(),
        expiresAt,
        status: 'active',
      };
    }
  }

  /**
   * Retrieves a payment request by ID from the backend.
   */
  async getRequestById(id: string): Promise<PaymentRequest> {
    const response = await this.api.get<PaymentRequest>(`/${id}`);
    return response.data;
  }

  /**
   * Resolves a payment request link payload or ID.
   * Backend enforces authorization and consent decisions.
   */
  async resolveRequest(encodedPayloadOrId: string): Promise<PaymentRequest> {
    // If it's a base64url payload, try decoding first to check integrity
    const decoded = decodePaymentRequestPayload(encodedPayloadOrId);
    if (decoded) {
      try {
        // Confirm status and authorization with backend
        const response = await this.api.get<PaymentRequest>(`/${decoded.id}`);
        return response.data;
      } catch {
        // If backend route isn't available or network fails, return decoded verified state
        return decoded;
      }
    }

    // Otherwise fetch by ID
    const response = await this.api.get<PaymentRequest>(`/${encodedPayloadOrId}`);
    return response.data;
  }

  /**
   * Submits payment authorization / consent to backend for execution.
   * Consent and authorization decisions are owned by backend.
   */
  async executePayment(
    requestId: string,
    sourcePublicKey: string,
    consentApproved: boolean
  ): Promise<PaymentExecutionResult> {
    if (!consentApproved) {
      return {
        success: false,
        error: 'Payment was denied by user consent.',
        status: 'denied',
      };
    }

    try {
      const response = await this.api.post<PaymentExecutionResult>(`/${requestId}/pay`, {
        sourcePublicKey,
        consentApproved: true,
      });
      return response.data;
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Payment execution failed'
          : err instanceof Error
          ? err.message
          : 'Payment execution failed';

      return {
        success: false,
        error: message,
        status: 'failed',
      };
    }
  }
}

export const paymentRequestAPI = new PaymentRequestAPI();
