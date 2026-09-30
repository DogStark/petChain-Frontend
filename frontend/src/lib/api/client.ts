export type EndpointClass = 'read' | 'mutation' | 'upload';

/**
 * Timeout budgets (ms) per endpoint class. Every request is bounded so that
 * mobile networks cannot leave forms and loading states pending forever.
 */
export const TIMEOUT_BUDGETS: Record<EndpointClass, number> = {
  read: 10_000,
  mutation: 20_000,
  upload: 60_000,
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly body: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: string; retryable?: boolean; body?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'unknown_error';
    this.retryable = options.retryable ?? false;
    this.body = options.body;
  }
}

/**
 * Thrown when the caller aborts a request. It is intentionally distinct from
 * ApiError so user cancellation is never reported as a server error.
 */
export class RequestAbortedError extends Error {
  readonly code = 'request_aborted';
  readonly retryable = false;

  constructor(message = 'Request was cancelled.') {
    super(message);
    this.name = 'RequestAbortedError';
  }
}

/**
 * Thrown when a request exceeds its timeout budget. Timed-out reads are safe
 * to retry; timed-out mutations must be reconciled via idempotency keys.
 */
export class RequestTimeoutError extends ApiError {
  constructor(endpointClass: EndpointClass, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`, {
      code: 'request_timeout',
      retryable: endpointClass === 'read',
    });
    this.name = 'RequestTimeoutError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  /** Endpoint class used to select the timeout budget. Defaults to `read`. */
  endpointClass?: EndpointClass;
  /** Caller-provided signal; aborts propagate to the underlying fetch. */
  signal?: AbortSignal | null;
  /** Overrides the class budget when a specific endpoint needs more/less time. */
  timeoutMs?: number;
  /** Idempotency key used to reconcile timed-out mutations. */
  idempotencyKey?: string;
}

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? '';

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (error instanceof Error && error.name === 'AbortError');
}

/**
 * Performs a fetch with a bounded timeout and abort propagation.
 *
 * - Every request gets a timeout derived from its endpoint class.
 * - A caller-provided AbortSignal is forwarded and combined with the timeout.
 * - Caller cancellation rejects with RequestAbortedError (not a server error).
 * - Timeout rejects with RequestTimeoutError, marked retryable for reads.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    endpointClass = 'read',
    signal: callerSignal,
    timeoutMs = TIMEOUT_BUDGETS[endpointClass],
    idempotencyKey,
    headers,
    ...init
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) {
      throw new RequestAbortedError();
    }
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const requestHeaders = new Headers(headers);
  if (idempotencyKey) {
    requestHeaders.set('Idempotency-Key', idempotencyKey);
  }
  if (init.body && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new ApiError(`Request failed with status ${response.status}.`, {
        status: response.status,
        code: `http_${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
        body,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (timedOut) {
      throw new RequestTimeoutError(endpointClass, timeoutMs);
    }
    if (isAbortError(error)) {
      throw new RequestAbortedError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

export const apiClient = {
  get: <T = unknown>(path: string, options: RequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'GET', endpointClass: options.endpointClass ?? 'read' }),
  post: <T = unknown>(path: string, body?: unknown, options: RequestOptions = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      endpointClass: options.endpointClass ?? 'mutation',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T = unknown>(path: string, body?: unknown, options: RequestOptions = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      endpointClass: options.endpointClass ?? 'mutation',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T = unknown>(path: string, body?: unknown, options: RequestOptions = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PATCH',
      endpointClass: options.endpointClass ?? 'mutation',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T = unknown>(path: string, options: RequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'DELETE', endpointClass: options.endpointClass ?? 'mutation' }),
};
