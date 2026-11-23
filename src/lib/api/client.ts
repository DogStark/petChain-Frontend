export type ApiErrorKind = "network" | "http" | "auth" | "abort";

export interface ApiErrorMetadata {
  status: number;
  statusText?: string;
  correlationId?: string;
  requestId?: string;
  code?: string;
  contentType?: string;
}

export class ApiError extends Error {
  readonly kind?: ApiErrorKind;
  readonly status?: number;
  readonly statusText?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly code?: string;
  readonly contentType?: string;
  readonly body?: unknown;
  readonly details?: unknown;

  constructor(
    kindOrMessage: ApiErrorKind | string,
    messageOrMetadata: string | ApiErrorMetadata,
    statusOrDetails?: number | unknown,
    body?: unknown,
  ) {
    let kind: ApiErrorKind | undefined;
    let message: string;
    let status: number | undefined;
    let details: unknown;
    let metadata: ApiErrorMetadata | undefined;

    if (typeof kindOrMessage === "string") {
      // Legacy signature: new ApiError(message, metadata, details)
      message = kindOrMessage;
      metadata = messageOrMetadata as ApiErrorMetadata;
      details = statusOrDetails;
      status = metadata.status;
    } else {
      // New signature: new ApiError(kind, message, status?, body?)
      kind = kindOrMessage;
      message = messageOrMetadata as string;
      status = statusOrDetails as number | undefined;
      details = body;
    }

    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.statusText = metadata?.statusText;
    this.correlationId = metadata?.correlationId;
    this.requestId = metadata?.requestId;
    this.code = metadata?.code;
    this.contentType = metadata?.contentType;
    this.body = details;
    this.details = details;
  }
}

export interface RequestClientOptions {
  baseUrl?: string;
  getAccessToken: () => string | null | undefined;
  refreshAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions extends Omit<RequestInit, "signal"> {
  signal?: AbortSignal;
  /** Skip attaching the Authorization header (e.g. login/refresh endpoints). */
  skipAuth?: boolean;
  /** Skip the single-flight refresh + retry on 401. */
  skipRefresh?: boolean;
}

export interface RequestClient {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const MAX_TEXT_LENGTH = 500;

function readHeader(headers: Headers | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : undefined;
}

function sanitizeMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Never surface stack traces or internal server details to users.
  if (/\bat\s+\S+\s*\(/.test(trimmed) || /\bstack\b/i.test(trimmed)) {
    return undefined;
  }
  return trimmed.length > MAX_TEXT_LENGTH ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…` : trimmed;
}

function extractMessageFromJson(body: unknown): { message?: string; code?: string } {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const message =
    sanitizeMessage(record.message) ??
    sanitizeMessage(record.error) ??
    sanitizeMessage(record.detail) ??
    sanitizeMessage(record.title);
  const code = typeof record.code === 'string' ? record.code : undefined;
  return { message, code };
}

async function readBody(response: Response): Promise<{ message?: string; code?: string; details?: unknown }> {
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      const body = await response.json();
      const { message, code } = extractMessageFromJson(body);
      return { message, code, details: body };
    }
    if (contentType.includes('text/') || contentType.includes('application/xml')) {
      const text = await response.text();
      return { message: sanitizeMessage(text), details: text };
    }
    if (contentType.includes('application/octet-stream') || contentType.includes('blob')) {
      const blob = await response.blob();
      return { details: blob };
    }
    // Unknown content type: attempt text, fall back to blob.
    const text = await response.text();
    return { message: sanitizeMessage(text), details: text };
  } catch {
    return {};
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  const { message, code, details } = await readBody(response);
  const metadata: ApiErrorMetadata = {
    status: response.status,
    statusText: response.statusText || undefined,
    correlationId:
      readHeader(response.headers, 'x-correlation-id') ??
      readHeader(response.headers, 'x-request-id'),
    requestId: readHeader(response.headers, 'x-request-id'),
    code,
    contentType: response.headers.get('content-type') ?? undefined,
  };
  return new ApiError(message ?? GENERIC_ERROR_MESSAGE, metadata, details);
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204 || response.status === 205) return undefined;
  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

export function createRequestClient(options: RequestClientOptions): RequestClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "";

  // Single-flight refresh: concurrent 401s share one in-flight refresh promise.
  let refreshPromise: Promise<string | null> | null = null;

  function refreshOnce(): Promise<string | null> {
    if (!refreshPromise) {
      refreshPromise = options
        .refreshAccessToken()
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  async function send(
    path: string,
    requestOptions: RequestOptions,
    token: string | null | undefined,
  ): Promise<Response> {
    const { skipAuth, skipRefresh: _skipRefresh, signal, headers, ...rest } = requestOptions;
    const mergedHeaders = new Headers(headers);
    if (!skipAuth && token) {
      mergedHeaders.set("Authorization", `Bearer ${token}`);
    }
    if (rest.body !== undefined && rest.body !== null && !mergedHeaders.has("Content-Type")) {
      mergedHeaders.set("Content-Type", "application/json");
    }
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    try {
      return await fetchImpl(url, { ...rest, headers: mergedHeaders, signal });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw new ApiError("abort", "Request aborted");
      }
      throw new ApiError(
        "network",
        error instanceof Error ? error.message : "Network request failed",
      );
    }
  }

  async function request<T = unknown>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const token = requestOptions.skipAuth ? null : options.getAccessToken();
    let response = await send(path, requestOptions, token);

    if (response.status === 401 && !requestOptions.skipAuth && !requestOptions.skipRefresh) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        response = await send(path, requestOptions, refreshed);
      }
    }

    if (!response.ok) {
      const body = await parseBody(response);
      const kind: ApiErrorKind = response.status === 401 || response.status === 403 ? "auth" : "http";
      const message =
        (typeof body === "object" && body !== null && "message" in body && typeof (body as { message?: unknown }).message === "string"
          ? (body as { message: string }).message
          : undefined) ?? `Request failed with status ${response.status}`;
      throw new ApiError(kind, message, response.status, body);
    }

    return (await parseBody(response)) as T;
  }

  function withBody(method: string) {
    return <T = unknown>(path: string, body?: unknown, requestOptions: RequestOptions = {}) =>
      request<T>(path, {
        ...requestOptions,
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  }

  return {
    request,
    get: <T = unknown>(path: string, requestOptions?: RequestOptions) =>
      request<T>(path, { ...requestOptions, method: "GET" }),
    post: withBody("POST"),
    put: withBody("PUT"),
    patch: withBody("PATCH"),
    delete: <T = unknown>(path: string, requestOptions?: RequestOptions) =>
      request<T>(path, { ...requestOptions, method: "DELETE" }),
  };
}

export async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response;
}
}
