import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type TransactionType = 'record_creation' | 'record_update' | 'access_grant' | 'access_revoke' | 'vaccination' | 'transfer';

export interface Transaction {
  id: string;
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  fromAddress: string;
  toAddress?: string;
  amount?: string;
  fee: string;
  timestamp: string;
  blockNumber?: number;
  confirmations: number;
  metadata?: Record<string, any>;
  errorMessage?: string;
}

export interface TransactionReceipt {
  transactionId: string;
  hash: string;
  status: TransactionStatus;
  blockNumber: number;
  timestamp: string;
  gasUsed: string;
  effectiveFee: string;
  logs: any[];
}

export interface TransactionCost {
  baseFee: string;
  priorityFee?: string;
  totalFee: string;
  estimatedUSD?: number;
}

export interface TransactionFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

class TransactionAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/transactions`,
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

  async getTransactionHistory(filters?: TransactionFilters): Promise<Transaction[]> {
    const response = await this.api.get('/history', { params: filters });
    return response.data;
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const response = await this.api.get(`/${id}`);
    return response.data;
  }

  async getTransactionByHash(hash: string): Promise<Transaction> {
    const response = await this.api.get(`/hash/${hash}`);
    return response.data;
  }

  async getTransactionReceipt(id: string): Promise<TransactionReceipt> {
    const response = await this.api.get(`/${id}/receipt`);
    return response.data;
  }

  async getTransactionCost(id: string): Promise<TransactionCost> {
    const response = await this.api.get(`/${id}/cost`);
    return response.data;
  }

  async estimateTransactionCost(type: TransactionType, data?: any): Promise<TransactionCost> {
    const response = await this.api.post('/estimate', { type, data });
    return response.data;
  }

  async retryFailedTransaction(id: string): Promise<Transaction> {
    const response = await this.api.post(`/${id}/retry`);
    return response.data;
  }

  async cancelPendingTransaction(id: string): Promise<void> {
    await this.api.post(`/${id}/cancel`);
  }

  async getFailedTransactions(): Promise<Transaction[]> {
    const response = await this.api.get('/failed');
    return response.data;
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    const response = await this.api.get('/pending');
    return response.data;
  }

  async getTotalCosts(startDate?: string, endDate?: string): Promise<{
    totalFees: string;
    totalTransactions: number;
    averageFee: string;
    estimatedUSD: number;
  }> {
    const response = await this.api.get('/costs/summary', {
      params: { startDate, endDate },
    });
    return response.data;
  }
}

export const transactionAPI = new TransactionAPI();
