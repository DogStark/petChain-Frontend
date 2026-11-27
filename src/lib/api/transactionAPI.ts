import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { attachCorrelationInterceptor } from './correlationInterceptor';

export type TransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'replaced'
  | 'expired';
export type TransactionType =
  | 'record_creation'
  | 'record_update'
  | 'access_grant'
  | 'access_revoke'
  | 'vaccination'
  | 'transfer';

export type TransactionEstimateData = Record<string, unknown>;

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
  metadata?: Record<string, unknown>;
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
  logs: Record<string, unknown>[];
}

export interface TransactionCost {
  baseFee: string;
  priorityFee?: string;
  totalFee: string;
  estimatedUSD?: number;
}

export interface TransactionDataMap {
  record_creation: { petId: string; recordType: string; payload: Record<string, unknown> };
  record_update: { petId: string; recordId: string; changes: Record<string, unknown> };
  access_grant: { petId: string; granteeAddress: string; permissions: string[] };
  access_revoke: { petId: string; granteeAddress: string };
  vaccination: { petId: string; vaccineId: string; administerDate: string };
  transfer: { petId: string; toAddress: string };
}

export type EstimateData = TransactionDataMap[TransactionType];

export interface TransactionFilters {
  status?: TransactionStatus;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  /** Opaque cursor for cursor-based pagination (replaces `offset`). */
  cursor?: string;
  /** Direction of traversal relative to `cursor`. */
  direction?: CursorDirection;
}

export type CursorDirection = 'next' | 'prev';

/** Cursor-based pagination request parameters. */
export interface CursorPaginationParams {
  cursor?: string;
  direction?: CursorDirection;
  limit?: number;
}

/** Cursor-based pagination metadata returned by the history endpoint. */
export interface CursorPageInfo {
  nextCursor: string | null;
  prevCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** A page of transactions plus its cursor metadata. */
export interface CursorPage<T> {
  items: T[];
  pageInfo: CursorPageInfo;
}

/**
 * Options accepted by mutating transaction calls.
 *
 * `idempotencyKey` is forwarded as the `Idempotency-Key` HTTP header so the
 * server can safely de-duplicate retries and rapid double-submits.  The field
 * is optional so callers that haven't migrated yet keep working unchanged.
 */
export interface TransactionRequestOptions {
  idempotencyKey?: string;
}

class TransactionAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/transactions`,
      withCredentials: true,
    });

    attachCorrelationInterceptor(this.api);

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Build the per-request headers object, adding `Idempotency-Key` when provided. */
  private buildHeaders(opts?: TransactionRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {};
    if (opts?.idempotencyKey) {
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }
    return headers;
  }

  // ── Read operations (no idempotency header needed) ─────────────────────

  async getTransactionHistory(filters?: TransactionFilters): Promise<Transaction[]> {
    const response = await this.api.get('/history', { params: filters });
    return response.data;
  }

  /**
   * Fetch a page of transaction history using cursor-based pagination.
   *
   * Falls back to wrapping a plain array response (legacy backend) so callers
   * always receive a `CursorPage`.
   */
  async getTransactionHistoryPage(
    filters?: TransactionFilters,
    pagination?: CursorPaginationParams
  ): Promise<CursorPage<Transaction>> {
    const response = await this.api.get('/history', {
      params: { ...filters, ...pagination },
    });
    const data = response.data;

    if (Array.isArray(data)) {
      return {
        items: data as Transaction[],
        pageInfo: {
          nextCursor: null,
          prevCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const items: Transaction[] = data?.items ?? data?.data ?? [];
    const pageInfo = data?.pageInfo ?? {};
    return {
      items,
      pageInfo: {
        nextCursor: pageInfo.nextCursor ?? null,
        prevCursor: pageInfo.prevCursor ?? null,
        hasNextPage: Boolean(pageInfo.hasNextPage ?? pageInfo.nextCursor),
        hasPreviousPage: Boolean(pageInfo.hasPreviousPage ?? pageInfo.prevCursor),
      },
    };
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

  // ── Write operations (accept optional idempotency key) ─────────────────

  async estimateTransactionCost(
    type: TransactionType,
    data?: EstimateData,
    opts?: TransactionRequestOptions
  ): Promise<TransactionCost> {
    const response = await this.api.post(
      '/estimate',
      { type, data },
      { headers: this.buildHeaders(opts) }
    );
    return response.data;
  }

  async retryFailedTransaction(
    id: string,
    opts?: TransactionRequestOptions
  ): Promise<Transaction> {
    const response = await this.api.post(
      `/${id}/retry`,
      {},
      { headers: this.buildHeaders(opts) }
    );
    return response.data;
  }

  async cancelPendingTransaction(
    id: string,
    opts?: TransactionRequestOptions
  ): Promise<void> {
    await this.api.post(
      `/${id}/cancel`,
      {},
      { headers: this.buildHeaders(opts) }
    );
  }

  async getFailedTransactions(): Promise<Transaction[]> {
    const response = await this.api.get('/failed');
    return response.data;
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    const response = await this.api.get('/pending');
    return response.data;
  }

  async getTotalCosts(
    startDate?: string,
    endDate?: string
  ): Promise<{
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
