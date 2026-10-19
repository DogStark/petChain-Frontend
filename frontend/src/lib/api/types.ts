export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Endpoint classes group requests by their expected latency so each request
 * gets a bounded timeout budget instead of hanging indefinitely.
 */
export type EndpointClass = 'fast' | 'standard' | 'slow';

/**
 * Timeout budgets (in milliseconds) per endpoint class.
 * - fast: lightweight reads (lookups, polling, autocomplete)
 * - standard: typical reads and small mutations
 * - slow: heavy mutations, uploads, or long-running operations
 */
export const TIMEOUT_BUDGETS: Record<EndpointClass, number> = {
  fast: 5_000,
  standard: 15_000,
  slow: 60_000,
};

/**
 * Error codes surfaced by the API client. `timeout` and `aborted` are
 * client-side conditions and must not be reported as server errors.
 */
export type ApiErrorCode =
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http'
  | 'parse';

export interface ApiError extends Error {
  code: ApiErrorCode;
  /** HTTP status when the failure originated from a server response. */
  status?: number;
  /** Whether the caller may safely retry the request. */
  retryable: boolean;
  /** True when the request was cancelled by the user. */
  aborted?: boolean;
}

/**
 * Options accepted by every API request. `signal` lets callers cancel a
 * request; `endpointClass` selects the timeout budget.
 */
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  endpointClass?: EndpointClass;
  /** Overrides the endpoint-class budget when a specific timeout is needed. */
  timeoutMs?: number;
  /**
   * Idempotency key for mutations so timed-out writes can be safely
   * retried or reconciled by the server.
   */
  idempotencyKey?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}
