export interface ApiErrorMetadata {
  status: number;
  statusText?: string;
  correlationId?: string;
  requestId?: string;
  code?: string;
  contentType?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly code?: string;
  readonly contentType?: string;
  readonly details?: unknown;

  constructor(message: string, metadata: ApiErrorMetadata, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = metadata.status;
    this.statusText = metadata.statusText;
    this.correlationId = metadata.correlationId;
    this.requestId = metadata.requestId;
    this.code = metadata.code;
    this.contentType = metadata.contentType;
    this.details = details;
  }
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

export async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response;
}
