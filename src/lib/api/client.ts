export type HttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  /** Idempotency key for eligible mutations. Required to retry non-idempotent methods. */
  idempotencyKey?: string;
  /** Override the default retry policy for this request. */
  retry?: Partial<RetryPolicy>;
}

export interface RetryPolicy {
  /** Maximum number of retry attempts after the initial request. */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number;
  /** Upper bound for any single backoff delay. */
  maxDelayMs: number;
  /** HTTP status codes considered transient and safe to retry. */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 300,
  maxDelayMs: 5_000,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
};

/** Methods that are safe to retry without an idempotency key. */
const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Methods that may be retried when an idempotency key is supplied. */
const IDEMPOTENT_KEY_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
  retryPolicy?: Partial<RetryPolicy>;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Parse a Retry-After header (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now);
  }

  return undefined;
}

/** Whether a request may be retried given its method and idempotency key. */
export function isRetryableRequest(method: HttpMethod, idempotencyKey?: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  if (IDEMPOTENT_KEY_METHODS.has(method)) return Boolean(idempotencyKey);
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
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...config.retryPolicy };
    this.sleep = config.sleep ?? defaultSleep;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const policy: RetryPolicy = { ...this.retryPolicy, ...options.retry };
    const canRetry = isRetryableRequest(method, options.idempotencyKey);

    const headers: Record<string, string> = { ...options.headers };
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const init: RequestInit = {
      method,
      headers,
      signal: options.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, init);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (!canRetry || attempt >= policy.maxRetries) throw error;
        await this.sleep(computeBackoff(attempt, policy));
        attempt += 1;
        continue;
      }

      if (response.ok) {
        return this.parseBody<T>(response);
      }

      const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
      const isTransient = policy.retryableStatuses.includes(response.status);

      if (canRetry && isTransient && attempt < policy.maxRetries) {
        const delay = retryAfterMs ?? computeBackoff(attempt, policy);
        await this.sleep(Math.min(delay, policy.maxDelayMs));
        attempt += 1;
        continue;
      }

      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        retryAfterMs,
      );
    }
  }

  private async parseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (text === '') return undefined as T;
    return JSON.parse(text) as T;
  }
}
