/**
 * API Service for Wata-Board Frontend
 * Handles all backend API calls with proper CORS support
 */

import React from 'react';

export interface PaymentRequest {
  meter_id: string;
  amount: number;
  userId: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  rateLimitInfo?: {
    remainingRequests?: number;
    resetTime?: string;
    queued?: boolean;
    queuePosition?: number;
  };
}

export interface RateLimitStatus {
  success: boolean;
  data?: {
    remainingRequests: number;
    resetTime: Date;
    allowed: boolean;
    queued: boolean;
    queuePosition?: number;
    queueLength: number;
  };
  error?: string;
}

export interface PaymentInfo {
  success: boolean;
  data?: {
    meterId: string;
    totalPaid: number;
    network: string;
  };
  error?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
}

class ApiService {
  private baseURL: string;
  private isDevelopment: boolean;

  constructor() {
    // Use proxy in development, direct URL in production
    this.isDevelopment = import.meta.env.DEV;
    this.baseURL = this.isDevelopment ? '/api' : this.getProductionApiUrl();
  }

  private getProductionApiUrl(): string {
    // In production, use the configured API URL
    return import.meta.env.VITE_API_URL || 'https://your-api-domain.com';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for CORS
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Handle CORS errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 403) {
          throw new Error('CORS policy violation. Check your domain configuration.');
        }
        
        if (response.status === 429) {
          throw new Error(errorData.error || 'Rate limit exceeded. Please try again later.');
        }
        
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Unable to connect to the API server.');
      }
      throw error;
    }
  }

  /**
   * Process a utility payment
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('/payment', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get rate limit status for a user
   */
  async getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
    return this.request<RateLimitStatus>(`/rate-limit/${encodeURIComponent(userId)}`);
  }

  /**
   * Get payment information for a meter
   */
  async getPaymentInfo(meterId: string): Promise<PaymentInfo> {
    return this.request<PaymentInfo>(`/payment/${encodeURIComponent(meterId)}`);
  }

  /**
   * Check API health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getHealthStatus();
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Export types for convenience
export type { PaymentRequest, PaymentResponse, RateLimitStatus, PaymentInfo, HealthStatus };

// Utility functions for common operations
export const paymentUtils = {
  /**
   * Format payment amount for display
   */
  formatAmount: (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XLM',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  },

  /**
   * Validate payment request
   */
  validatePaymentRequest: (request: PaymentRequest): string[] => {
    const errors: string[] = [];

    if (!request.meter_id || request.meter_id.trim().length === 0) {
      errors.push('Meter ID is required');
    }

    if (!request.amount || request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (request.amount > 10000) {
      errors.push('Amount cannot exceed 10,000 XLM');
    }

    if (!request.userId || request.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  },

  /**
   * Get rate limit message for display
   */
  getRateLimitMessage: (rateLimitInfo?: PaymentResponse['rateLimitInfo']): string => {
    if (!rateLimitInfo) return '';

    if (rateLimitInfo.queued && rateLimitInfo.queuePosition) {
      return `Your payment is queued. Position: #${rateLimitInfo.queuePosition}`;
    }

    if (rateLimitInfo.remainingRequests !== undefined) {
      return `${rateLimitInfo.remainingRequests} requests remaining`;
    }

    return '';
  },

  /**
   * Check if payment is queued
   */
  isPaymentQueued: (response: PaymentResponse): boolean => {
    return !!(response.rateLimitInfo?.queued);
  },

  /**
   * Check if rate limited
   */
  isRateLimited: (response: PaymentResponse): boolean => {
    return !response.success && response.error?.includes('Rate limit exceeded');
  },
};

// React hooks for common operations
export const useApi = () => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  React.useEffect(() => {
    const checkConnection = async () => {
      setIsConnecting(true);
      try {
        const connected = await apiService.testConnection();
        setIsConnected(connected);
      } catch (error) {
        setIsConnected(false);
      } finally {
        setIsConnecting(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    isConnecting,
    apiService,
    paymentUtils,
  };
};

export default apiService;
