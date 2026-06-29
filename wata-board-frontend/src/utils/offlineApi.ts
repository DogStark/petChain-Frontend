import { useCallback, useEffect, useState } from 'react';

const QUEUE_STORAGE_KEY = 'wata-board:offline-request-queue';
const CACHE_STORAGE_KEY = 'wata-board:offline-response-cache';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const QUEUEABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_PATHS = ['/login', '/register', '/password-reset', '/reset-password'];

export type ConflictResolutionStrategy = 'keep-local' | 'server-wins' | 'manual';

export interface OfflineApiOptions<TFallback = unknown> {
  enableQueue?: boolean;
  retryAttempts?: number;
  timeout?: number;
  fallbackData?: TFallback;
  cacheKey?: string;
  conflictStrategy?: ConflictResolutionStrategy;
}

export interface QueuedOfflineRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  conflictStrategy: ConflictResolutionStrategy;
}

interface CachedOfflineResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timestamp: number;
}

export interface ReplaySummary {
  replayed: string[];
  failed: Array<{ id: string; error: string }>;
  conflicts: QueuedOfflineRequest[];
}

export class OfflineApiError extends Error {
  public readonly isOffline: boolean;
  public readonly queuedActionId?: string;
  public readonly status?: number;

  constructor(message: string, options: { isOffline?: boolean; queuedActionId?: string; status?: number } = {}) {
    super(message);
    this.name = 'OfflineApiError';
    this.isOffline = options.isOffline ?? false;
    this.queuedActionId = options.queuedActionId;
    this.status = options.status;
  }
}

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeMethod = (method?: string) => (method ?? 'GET').toUpperCase();

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> | undefined => {
  if (!headers) return undefined;
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
};

const serializeBody = (body: BodyInit | null | undefined): string | undefined => {
  if (body == null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return JSON.stringify(Object.fromEntries(body.entries()));
  }
  return String(body);
};

const readJson = <T>(key: string, fallback: T): T => {
  if (!hasStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const createJsonResponse = <T>(cached: CachedOfflineResponse<T>): Response =>
  new Response(JSON.stringify(cached.data), {
    status: cached.status,
    statusText: cached.statusText,
    headers: {
      'Content-Type': 'application/json',
      ...cached.headers,
      'X-Offline-Cache': 'hit',
    },
  });

export const offlineQueue = {
  list(): QueuedOfflineRequest[] {
    return readJson<QueuedOfflineRequest[]>(QUEUE_STORAGE_KEY, []);
  },

  save(queue: QueuedOfflineRequest[]) {
    writeJson(QUEUE_STORAGE_KEY, queue);
    window.dispatchEvent(new CustomEvent('offline-api:queue-change', { detail: queue }));
  },

  enqueue(
    url: string,
    options: RequestInit = {},
    conflictStrategy: ConflictResolutionStrategy = 'manual',
  ): QueuedOfflineRequest {
    const request: QueuedOfflineRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      url,
      method: normalizeMethod(options.method),
      headers: normalizeHeaders(options.headers),
      body: serializeBody(options.body),
      timestamp: Date.now(),
      retryCount: 0,
      conflictStrategy,
    };

    this.save([...this.list(), request]);
    return request;
  },

  remove(id: string) {
    this.save(this.list().filter((request) => request.id !== id));
  },

  update(request: QueuedOfflineRequest) {
    this.save(this.list().map((item) => (item.id === request.id ? request : item)));
  },

  clear() {
    this.save([]);
  },
};

export const offlineCache = {
  get<T = unknown>(key: string): CachedOfflineResponse<T> | null {
    const cache = readJson<Record<string, CachedOfflineResponse<T>>>(CACHE_STORAGE_KEY, {});
    return cache[key] ?? null;
  },

  set<T = unknown>(key: string, response: CachedOfflineResponse<T>) {
    const cache = readJson<Record<string, CachedOfflineResponse<T>>>(CACHE_STORAGE_KEY, {});
    writeJson(CACHE_STORAGE_KEY, { ...cache, [key]: response });
  },

  clear() {
    writeJson(CACHE_STORAGE_KEY, {});
  },
};

export function shouldQueueForOffline(url: string, options: RequestInit = {}): boolean {
  const method = normalizeMethod(options.method);

  if (!QUEUEABLE_METHODS.has(method)) return false;
  return !SENSITIVE_PATHS.some((path) => url.includes(path));
}

export function isConnectivityError(error: unknown): boolean {
  if (error instanceof OfflineApiError) return error.isOffline;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  );
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestWithRetry(
  url: string,
  options: RequestInit,
  attempts: number,
  timeout: number,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      if (response.status >= 500) {
        throw new OfflineApiError(`Server error: ${response.status}`, { status: response.status });
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isConnectivityError(error) || attempt === attempts) break;
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 5000)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

async function cacheResponse(url: string, response: Response, cacheKey?: string) {
  if (normalizeMethod('GET') !== 'GET' || !response.ok) return;

  const cloned = response.clone();
  const contentType = cloned.headers.get('Content-Type') ?? '';
  const data = contentType.includes('application/json') ? await cloned.json() : await cloned.text();
  offlineCache.set(cacheKey ?? url, {
    data,
    status: cloned.status,
    statusText: cloned.statusText,
    headers: Object.fromEntries(cloned.headers.entries()),
    timestamp: Date.now(),
  });
}

export async function offlineFetch<TFallback = unknown>(
  url: string,
  options: RequestInit = {},
  offlineOptions: OfflineApiOptions<TFallback> = {},
): Promise<Response> {
  const {
    enableQueue = true,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    timeout = DEFAULT_TIMEOUT_MS,
    fallbackData,
    cacheKey,
    conflictStrategy = 'manual',
  } = offlineOptions;
  const method = normalizeMethod(options.method);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (enableQueue && shouldQueueForOffline(url, { ...options, method })) {
      const queued = offlineQueue.enqueue(url, { ...options, method }, conflictStrategy);
      throw new OfflineApiError('You are offline. The request has been queued for sync.', {
        isOffline: true,
        queuedActionId: queued.id,
      });
    }

    const cached = method === 'GET' ? offlineCache.get(cacheKey ?? url) : null;
    if (cached) return createJsonResponse(cached);
    if (fallbackData !== undefined) {
      return createJsonResponse({
        data: fallbackData,
        status: 200,
        statusText: 'Offline fallback',
        headers: {},
        timestamp: Date.now(),
      });
    }

    throw new OfflineApiError('You are offline. This request requires an internet connection.', { isOffline: true });
  }

  try {
    const response = await requestWithRetry(url, { ...options, method }, retryAttempts, timeout);
    if (method === 'GET') await cacheResponse(url, response, cacheKey);
    return response;
  } catch (error) {
    const cached = method === 'GET' ? offlineCache.get(cacheKey ?? url) : null;
    if (cached && isConnectivityError(error)) return createJsonResponse(cached);
    throw error;
  }
}

export async function replayQueuedRequests(): Promise<ReplaySummary> {
  const summary: ReplaySummary = { replayed: [], failed: [], conflicts: [] };
  const queue = offlineQueue.list();

  for (const request of queue) {
    try {
      const response = await requestWithRetry(
        request.url,
        {
          method: request.method,
          headers: request.headers,
          body: request.body,
        },
        DEFAULT_RETRY_ATTEMPTS,
        DEFAULT_TIMEOUT_MS,
      );

      if (response.status === 409) {
        if (request.conflictStrategy === 'server-wins') {
          offlineQueue.remove(request.id);
          summary.replayed.push(request.id);
        } else {
          summary.conflicts.push(request);
        }
        continue;
      }

      if (!response.ok) {
        throw new OfflineApiError(`Replay failed: ${response.status}`, { status: response.status });
      }

      offlineQueue.remove(request.id);
      summary.replayed.push(request.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown replay failure';
      const nextRequest = { ...request, retryCount: request.retryCount + 1 };
      offlineQueue.update(nextRequest);
      summary.failed.push({ id: request.id, error: message });
    }
  }

  return summary;
}

export function useOfflineApi() {
  const [queue, setQueue] = useState<QueuedOfflineRequest[]>(() => offlineQueue.list());

  useEffect(() => {
    const handleQueueChange = () => setQueue(offlineQueue.list());
    const handleOnline = () => {
      void replayQueuedRequests().then(handleQueueChange);
    };

    window.addEventListener('offline-api:queue-change', handleQueueChange);
    window.addEventListener('online', handleOnline);

    if (navigator.onLine && offlineQueue.list().length > 0) {
      void replayQueuedRequests().then(handleQueueChange);
    }

    return () => {
      window.removeEventListener('offline-api:queue-change', handleQueueChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const apiCall = useCallback(
    (url: string, options: RequestInit = {}, offlineOptions: OfflineApiOptions = {}) =>
      offlineFetch(url, options, offlineOptions),
    [],
  );

  return {
    apiCall,
    queue,
    queuedCount: queue.length,
    replayQueuedRequests,
    clearQueue: offlineQueue.clear.bind(offlineQueue),
    postPayment: (meterId: string, amount: number, userId: string) =>
      apiCall('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meter_id: meterId, amount, userId }),
      }),
    getPaymentStatus: (meterId: string) =>
      apiCall(`/api/payment/${meterId}`, { method: 'GET' }, { fallbackData: { totalPaid: 0, network: 'testnet' } }),
    getRateLimitStatus: (userId: string) =>
      apiCall(
        `/api/rate-limit/${userId}`,
        { method: 'GET' },
        { retryAttempts: 1, fallbackData: { remainingRequests: 5, resetTime: Date.now() + 60000 } },
      ),
    submitReview: (rating: number, comment: string, transactionHash: string) =>
      apiCall('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, transaction_hash: transactionHash }),
      }),
  };
}

export function handleOfflineError(error: Error): {
  isOffline: boolean;
  message: string;
  queuedActionId?: string;
} {
  if (error instanceof OfflineApiError) {
    return {
      isOffline: error.isOffline,
      message: error.message,
      queuedActionId: error.queuedActionId,
    };
  }

  return {
    isOffline: isConnectivityError(error),
    message: error.message,
  };
}

export function shouldShowOfflineUI(error: unknown): boolean {
  return error instanceof OfflineApiError ? error.isOffline : isConnectivityError(error);
}

export function getOfflineErrorMessage(error: Error, context?: string): string {
  if (error instanceof OfflineApiError) {
    if (error.queuedActionId) {
      return `You're offline. Your ${context ?? 'action'} has been saved and will be completed automatically when you're back online.`;
    }
    return "You're offline. Please check your internet connection and try again.";
  }

  if (isConnectivityError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}
