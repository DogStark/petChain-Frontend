export type ApiErrorKind =
  | "network"
  | "timeout"
  | "abort"
  | "server"
  | "client"
  | "unknown";

/**
 * Endpoint classes with bounded timeout budgets (ms).
 * Every API request must fall into one of these classes so that no request
 * can remain pending indefinitely.
 */
export const ENDPOINT_TIMEOUTS = {
  /** Fast reads: list/detail fetches that should return quickly. */
  read: 10_000,
  /** Mutations: writes that may take longer on the server. */
  mutation: 20_000,
  /** Long-running operations (exports, bulk jobs). */
  longRunning: 60_000,
} as const;

export type EndpointClass = keyof typeof ENDPOINT_TIMEOUTS;

export function timeoutFor(endpointClass: EndpointClass = "read"): number {
  return ENDPOINT_TIMEOUTS[endpointClass];
}

/**
 * Header used to forward a server-provided correlation id and to echo a
 * client-generated one back to the server for log matching.
 */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/**
 * Correlation ids are opaque, log-safe tokens. We only accept a conservative
 * character set and bounded length so that a malicious or malformed server
 * value can never be rendered as markup, a URL, or a credential.
 */
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Validates a server-provided correlation id before it is displayed or
 * copied. Returns the trimmed id when it is safe, otherwise `undefined`.
 */
export function sanitizeCorrelationId(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Generates a client-side correlation id when the server did not provide
 * one, so every retryable error still has an id support can reference.
 */
export function generateCorrelationId(): string {
  const cryptoObj = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `cid-${Date.now().toString(36)}-${random}`;
}

/**
 * Resolves the correlation id for a request: prefer a validated
 * server-provided value, otherwise generate one for retryable failures.
 */
export function resolveCorrelationId(
  serverValue: unknown,
  options: { retryable?: boolean } = {},
): string | undefined {
  const sanitized = sanitizeCorrelationId(serverValue);
  if (sanitized) {
    return sanitized;
  }
  return options.retryable ? generateCorrelationId() : undefined;
}

/**
 * Error thrown by the API client for any failed request.
 *
 * `kind` distinguishes user-initiated cancellation (`abort`) from real
 * failures so the UI never reports a cancellation as a server error.
 * `retryable` marks transient failures (network/timeout/server) that the UI
 * may safely retry; timed-out mutations should be reconciled via idempotency
 * keys before retrying.
 *
 * `correlationId` is a log-safe token (never a credential or response body)
 * that support can use to match a user-visible failure to server logs.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly endpointClass: EndpointClass;
  readonly correlationId?: string;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      status?: number;
      retryable?: boolean;
      endpointClass?: EndpointClass;
      correlationId?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.endpointClass = options.endpointClass ?? "read";
    this.retryable =
      options.retryable ??
      (this.kind === "network" ||
        this.kind === "timeout" ||
        this.kind === "server");
    this.correlationId = sanitizeCorrelationId(options.correlationId);
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  /** True when the user (or caller) cancelled the request. */
  get isAbort(): boolean {
    return this.kind === "abort";
  }

  /** True when the request exceeded its timeout budget. */
  get isTimeout(): boolean {
    return this.kind === "timeout";
  }

  /**
   * The correlation id to show in support copy, or `undefined` when none is
   * available. Only the id itself is exposed — never headers, tokens, or the
   * response body.
   */
  get supportCorrelationId(): string | undefined {
    return this.correlationId;
  }
}

/**
 * Normalizes any thrown value into an ApiError.
 *
 * AbortError from fetch/AbortController is mapped to `kind: "abort"` and is
 * never retryable, so callers can distinguish user cancellation from a
 * server error. Timeout aborts (raised by our own controller) are mapped to
 * `kind: "timeout"` and remain retryable.
 *
 * A server-provided correlation id is validated before being attached; when
 * absent, retryable errors receive a generated id so support always has one.
 */
export function toApiError(
  error: unknown,
  context: {
    endpointClass?: EndpointClass;
    timedOut?: boolean;
    correlationId?: unknown;
  } = {},
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const endpointClass = context.endpointClass ?? "read";

  if (isAbortError(error)) {
    if (context.timedOut) {
      return new ApiError(
        `Request timed out after ${timeoutFor(endpointClass)}ms`,
        {
          kind: "timeout",
          endpointClass,
          correlationId: resolveCorrelationId(context.correlationId, {
            retryable: true,
          }),
          cause: error,
        },
      );
    }
    return new ApiError("Request was cancelled", {
      kind: "abort",
      retryable: false,
      endpointClass,
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    return new ApiError("Network request failed", {
      kind: "network",
      endpointClass,
      correlationId: resolveCorrelationId(context.correlationId, {
        retryable: true,
      }),
      cause: error,
    });
  }

  const message =
    error instanceof Error ? error.message : "Unexpected API error";
  return new ApiError(message, {
    kind: "unknown",
    retryable: false,
    endpointClass,
    cause: error,
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
