export type HttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions extends Omit<RequestInit, 'method'> {
  method?: HttpMethod;
  /** Idempotency key required for retryable mutations (POST/PATCH). */
  idempotencyKey?: string;
  /** Override the default retry policy for this request. */
  retry?: RetryPolicy;
}

export interface RetryPolicy {
  /** Maximum number of retry attempts after the initial request. */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number;
  /** Upper bound for any single backoff delay in milliseconds. */
  maxDelayMs: number;
  /** HTTP status codes considered transient and safe to retry. */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 8_000,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
};

/** Methods that are safe to retry without an idempotency key. */
const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Methods that may be retried only when an idempotency key is supplied. */
const IDEMPOTENCY_KEY_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PATCH']);

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  retryPolicy?: RetryPolicy;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse a Retry-After header. Supports both delta-seconds and HTTP-date forms.
 * Returns milliseconds to wait, or undefined when absent/invalid.
 */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, dateMs - now);
}

/**
 * Determine whether a request may be retried. Safe methods are always eligible;
 * mutations require an idempotency key to avoid duplicating side effects.
 */
export function isRetryable(method: HttpMethod, idempotencyKey?: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  if (IDEMPOTENCY_KEY_METHODS.has(method)) return Boolean(idempotencyKey);
  return false;
}

function computeBackoff(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** attempt;
  return Math.min(exponential, policy.maxDelayMs);
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retryPolicy: RetryPolicy;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.retryPolicy = config.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.sleep = config.sleep ?? defaultSleep;
  }

  async request<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const method: HttpMethod = options.method ?? 'GET';
    const policy = options.retry ?? this.retryPolicy;
    const retryable = isRetryable(method, options.idempotencyKey);
    const maxAttempts = retryable ? policy.maxRetries + 1 : 1;

    const headers = new Headers(options.headers);
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, { ...options, method, headers });

        if (response.ok) {
          return (await this.parseBody<T>(response)) as T;
        }

        const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
        const error = new ApiError(
          `Request failed with status ${response.status}`,
          response.status,
          retryAfterMs,
        );

        const canRetry =
          retryable &&
          policy.retryableStatuses.includes(response.status) &&
          attempt < maxAttempts - 1;

        if (!canRetry) {
          throw error;
        }

        lastError = error;
        const delay = retryAfterMs ?? computeBackoff(attempt, policy);
        await this.sleep(delay);
      } catch (err) {
        if (err instanceof ApiError) throw err;

        // Network/transport failure: retry only when eligible.
        const canRetry = retryable && attempt < maxAttempts - 1;
        if (!canRetry) throw err;

        lastError = err;
        await this.sleep(computeBackoff(attempt, policy));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Request failed');
  }

  private async parseBody<T>(response: Response): Promise<T | undefined> {
    if (response.status === 204) return undefined;
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }
}
