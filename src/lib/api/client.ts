export type ApiErrorKind = "network" | "http" | "auth" | "abort";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly body?: unknown;

  constructor(kind: ApiErrorKind, message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.body = body;
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
