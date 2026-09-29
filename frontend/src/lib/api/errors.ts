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
 * Error thrown by the API client for any failed request.
 *
 * `kind` distinguishes user-initiated cancellation (`abort`) from real
 * failures so the UI never reports a cancellation as a server error.
 * `retryable` marks transient failures (network/timeout/server) that the UI
 * may safely retry; timed-out mutations should be reconciled via idempotency
 * keys before retrying.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  readonly endpointClass: EndpointClass;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      status?: number;
      retryable?: boolean;
      endpointClass?: EndpointClass;
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
}

/**
 * Normalizes any thrown value into an ApiError.
 *
 * AbortError from fetch/AbortController is mapped to `kind: "abort"` and is
 * never retryable, so callers can distinguish user cancellation from a
 * server error. Timeout aborts (raised by our own controller) are mapped to
 * `kind: "timeout"` and remain retryable.
 */
export function toApiError(
  error: unknown,
  context: { endpointClass?: EndpointClass; timedOut?: boolean } = {},
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const endpointClass = context.endpointClass ?? "read";

  if (isAbortError(error)) {
    if (context.timedOut) {
      return new ApiError(
        `Request timed out after ${timeoutFor(endpointClass)}ms`,
        { kind: "timeout", endpointClass, cause: error },
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
