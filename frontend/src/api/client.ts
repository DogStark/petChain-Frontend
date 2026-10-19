import { getAuthToken } from './auth';

export interface ApiRequestOptions extends RequestInit {
  /**
   * Optional AbortSignal so callers (e.g. route-level data loaders) can cancel
   * in-flight requests when the user navigates away.
   */
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

/**
 * Thin fetch wrapper used by the API layer.
 *
 * The provided `signal` is forwarded to `fetch` so that navigating away from a
 * route can abort the underlying request. Aborted requests reject with the
 * native `AbortError`, which callers can detect via `isAbortError` and ignore
 * instead of updating an unmounted view.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { signal, headers, ...rest } = options;

  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Returns true when an error was caused by an aborted request. Route-level
 * loaders use this to skip state updates after navigation away.
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'AbortError'
  );
}
