/**
 * Standardized, safe parsing of API error responses.
 *
 * API modules receive error bodies in a variety of shapes (JSON, plain text,
 * blobs, empty bodies). This module normalizes them into a single
 * {@link ApiError} shape that preserves HTTP status and correlation metadata
 * while never leaking raw server internals (stack traces, HTML error pages,
 * internal identifiers) into the user-facing message.
 */

export interface ApiErrorMetadata {
  /** HTTP status code, when available. */
  status?: number;
  /** Correlation / request ID surfaced by the server, when present. */
  correlationId?: string;
  /** Machine-readable error code, when present. */
  code?: string;
  /** Raw response body format that was parsed. */
  bodyType?: 'json' | 'text' | 'blob' | 'empty' | 'unknown';
}

export interface ApiError extends Error {
  /** Safe, user-facing message. Never contains server internals. */
  message: string;
  metadata: ApiErrorMetadata;
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const CORRELATION_HEADERS = [
  'x-correlation-id',
  'x-request-id',
  'request-id',
  'correlation-id',
];

const CORRELATION_BODY_KEYS = [
  'correlationId',
  'correlation_id',
  'requestId',
  'request_id',
  'traceId',
  'trace_id',
];

const CODE_BODY_KEYS = ['code', 'errorCode', 'error_code'];

const MESSAGE_BODY_KEYS = ['message', 'error', 'detail', 'title'];

/**
 * Patterns that indicate a message contains server internals we must not
 * surface to users (stack traces, file paths, SQL, HTML error pages).
 */
const INTERNAL_PATTERNS: RegExp[] = [
  /\bat\s+[\w$.]+\s*\(/i, // stack frame: "at Foo.bar ("
  /\b(?:Error|Exception):\s*\n\s*at\b/i, // node stack trace
  /\/\/\/\s*<reference/i, // TS reference directive
  /<\/?(?:html|body|head|pre|div|span|h1|p)\b/i, // HTML error page
  /\b(?:select|insert|update|delete)\b[\s\S]*\bfrom\b/i, // SQL
  /\b(?:node_modules|\/src\/|\.ts:\d+|\.js:\d+)/i, // source paths
  /\b(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)\b/, // raw network codes
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function looksInternal(message: string): boolean {
  return INTERNAL_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitize a candidate message so it is safe to show to users. Returns
 * `undefined` when the message is empty or appears to contain internals.
 */
function sanitizeMessage(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string') {
    return undefined;
  }
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (looksInternal(trimmed)) {
    return undefined;
  }
  // Collapse whitespace and cap length to avoid dumping large payloads.
  const collapsed = trimmed.replace(/\s+/g, ' ');
  return collapsed.length > 300 ? `${collapsed.slice(0, 297)}...` : collapsed;
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (isRecord(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === name && typeof value === 'string') {
        return value;
      }
    }
  }
  return undefined;
}

function extractCorrelationId(
  headers: unknown,
  body: Record<string, unknown> | undefined,
): string | undefined {
  for (const header of CORRELATION_HEADERS) {
    const value = readHeader(headers, header);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  if (body) {
    return firstString(body, CORRELATION_BODY_KEYS);
  }
  return undefined;
}

function extractFromJson(
  body: unknown,
): { message?: string; code?: string; correlationId?: string } {
  if (!isRecord(body)) {
    return {};
  }
  const message = sanitizeMessage(firstString(body, MESSAGE_BODY_KEYS));
  const code = firstString(body, CODE_BODY_KEYS);
  const correlationId = firstString(body, CORRELATION_BODY_KEYS);
  return { message, code, correlationId };
}

async function readBody(
  response: Response,
): Promise<{ bodyType: ApiErrorMetadata['bodyType']; text: string }> {
  try {
    const contentType = response.headers?.get?.('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const text = await response.text();
      return { bodyType: text.trim().length > 0 ? 'json' : 'empty', text };
    }
    if (contentType.includes('text/')) {
      const text = await response.text();
      return { bodyType: text.trim().length > 0 ? 'text' : 'empty', text };
    }
    if (typeof response.blob === 'function') {
      const blob = await response.blob();
      const text = await blob.text();
      return { bodyType: text.trim().length > 0 ? 'blob' : 'empty', text };
    }
    const text = await response.text();
    return { bodyType: text.trim().length > 0 ? 'text' : 'empty', text };
  } catch {
    return { bodyType: 'unknown', text: '' };
  }
}

function buildApiError(
  message: string,
  metadata: ApiErrorMetadata,
): ApiError {
  const error = new Error(message) as ApiError;
  error.name = 'ApiError';
  error.metadata = metadata;
  return error;
}

/**
 * Parse a failed {@link Response} into a safe {@link ApiError}.
 *
 * Handles JSON, text, and blob bodies, preserves status and correlation
 * metadata, and guarantees the user-facing message never contains server
 * internals.
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  const status = typeof response.status === 'number' ? response.status : undefined;
  const { bodyType, text } = await readBody(response);

  let parsed: { message?: string; code?: string; correlationId?: string } = {};
  if (bodyType === 'json' && text.trim().length > 0) {
    try {
      parsed = extractFromJson(JSON.parse(text));
    } catch {
      parsed = {};
    }
  } else if (bodyType === 'text' || bodyType === 'blob') {
    parsed = { message: sanitizeMessage(text) };
  }

  const correlationId = extractCorrelationId(response.headers, undefined) ?? parsed.correlationId;

  const metadata: ApiErrorMetadata = {
    status,
    correlationId,
    code: parsed.code,
    bodyType,
  };

  const message = parsed.message ?? DEFAULT_MESSAGE;
  return buildApiError(message, metadata);
}

/**
 * Parse an arbitrary thrown value (network error, unknown rejection) into a
 * safe {@link ApiError}. Never surfaces raw error internals to users.
 */
export function parseUnknownError(error: unknown): ApiError {
  const metadata: ApiErrorMetadata = { bodyType: 'unknown' };
  if (error instanceof Error) {
    const safe = sanitizeMessage(error.message);
    return buildApiError(safe ?? DEFAULT_MESSAGE, metadata);
  }
  return buildApiError(DEFAULT_MESSAGE, metadata);
}
