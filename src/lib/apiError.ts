import { containsSensitiveData } from './errorCorrelation';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface TranslatedApiError {
  message: string;
  correlationId: string | null;
}

const VALIDATION_CODE_KEYS: Record<string, string> = {
  PET_NAME_REQUIRED: 'errors.api.validation.petNameRequired',
  INVALID_DOSAGE: 'errors.api.validation.invalidDosage',
  DOSAGE_INVALID: 'errors.api.validation.invalidDosage',
  APPOINTMENT_CONFLICT: 'errors.api.validation.appointmentConflict',
  SLOT_TAKEN: 'errors.api.validation.appointmentConflict',
  STALE_VERSION: 'errors.api.validation.staleVersion',
  VERSION_MISMATCH: 'errors.api.validation.staleVersion',
  CONCURRENT_MODIFICATION: 'errors.api.validation.staleVersion',
  PET_ID_INVALID: 'errors.api.validation.invalidPetId',
  VET_ID_REQUIRED: 'errors.api.validation.invalidVetId',
  DATE_REQUIRED: 'errors.api.validation.invalidDate',
};

const SERVICE_CODE_KEYS: Record<string, string> = {
  UNAUTHORIZED: 'errors.api.unauthorized',
  AUTHENTICATION_REQUIRED: 'errors.api.unauthorized',
  FORBIDDEN: 'errors.api.forbidden',
  ACCESS_DENIED: 'errors.api.forbidden',
  NOT_FOUND: 'errors.api.notFound',
  CONFLICT: 'errors.api.conflict',
  RATE_LIMITED: 'errors.api.rateLimited',
  RATE_LIMIT_EXCEEDED: 'errors.api.rateLimited',
  SERVICE_UNAVAILABLE: 'errors.api.server',
  INTERNAL_SERVER_ERROR: 'errors.api.server',
};

const API_ERROR_KEY_MAP: Record<string, string> = {
  ...VALIDATION_CODE_KEYS,
  ...SERVICE_CODE_KEYS,
  INVALID_ID: 'errors.api.validation.invalidId',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readHeader(headers: unknown, names: string[]): string | undefined {
  if (!isRecord(headers)) return undefined;

  const get = headers.get;
  if (typeof get === 'function') {
    for (const name of names) {
      const value = get.call(headers, name);
      const result = getString(value);
      if (result) return result;
    }
  }

  for (const [key, value] of Object.entries(headers)) {
    if (names.includes(key.toLowerCase())) {
      const result = getString(value);
      if (result) return result;
    }
  }

  return undefined;
}

function getCorrelationId(data: unknown, headers: unknown): string | null {
  const body = isRecord(data) ? data : undefined;
  const nestedError = body && isRecord(body.error) ? body.error : undefined;
  const fromBody =
    getString(body?.correlationId) ??
    getString(body?.correlation_id) ??
    getString(body?.requestId) ??
    getString(body?.request_id) ??
    getString(nestedError?.correlationId) ??
    getString(nestedError?.correlation_id) ??
    getString(nestedError?.requestId) ??
    getString(nestedError?.request_id);
  const candidate =
    fromBody ??
    readHeader(headers, [
      'x-correlation-id',
      'x-request-id',
      'x-correlationid',
      'x-requestid',
    ]);

  if (!candidate || candidate.length > 128) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(candidate)) return null;
  return containsSensitiveData(candidate) ? null : candidate;
}

function getErrorKey(code: unknown): string | undefined {
  const normalized = getString(code)?.toUpperCase();
  return normalized ? API_ERROR_KEY_MAP[normalized] : undefined;
}

function getCode(data: unknown, error: unknown): string | undefined {
  const body = isRecord(data) ? data : undefined;
  const nestedError = body && isRecord(body.error) ? body.error : undefined;
  const bodyCode = getString(body?.code) ?? getString(nestedError?.code);
  if (bodyCode) return bodyCode;

  if (isRecord(error) && !('response' in error)) {
    return getString(error.code);
  }
  return undefined;
}

function getHttpStatus(response: unknown): number | undefined {
  if (!isRecord(response)) return undefined;
  const status = response.status;
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
}

function getStatusKey(status: number | undefined): string | undefined {
  switch (status) {
    case 401:
      return 'errors.api.unauthorized';
    case 403:
      return 'errors.api.forbidden';
    case 404:
      return 'errors.api.notFound';
    case 409:
      return 'errors.api.conflict';
    case 429:
      return 'errors.api.rateLimited';
    default:
      return status !== undefined && status >= 500 ? 'errors.api.server' : undefined;
  }
}

function isNetworkError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return (
    error.code === 'ERR_NETWORK' ||
    (error.isAxiosError === true && !isRecord(error.response))
  );
}

/**
 * Convert an untrusted API failure into a translated, privacy-safe message.
 * Only allowlisted codes are interpreted; server messages and detail fields
 * are never returned to the caller.
 */
export function translateApiError(error: unknown, t: Translate): TranslatedApiError {
  const response = isRecord(error) ? error.response : undefined;
  const data = isRecord(response) ? response.data : undefined;
  const headers = isRecord(response) ? response.headers : undefined;
  const correlationId = getCorrelationId(data, headers);
  if (error instanceof ApiError) {
    const translationKey =
      error.key === 'errors.validation.invalidId'
        ? 'errors.api.validation.invalidId'
        : error.key;
    return { message: t(translationKey, error.params), correlationId };
  }

  const code = getCode(data, error);
  const knownCodeKey = getErrorKey(code);

  if (knownCodeKey) {
    return { message: t(knownCodeKey), correlationId };
  }
  if (isNetworkError(error)) return { message: t('errors.api.network'), correlationId };

  if (code) {
    const deniedKey = getStatusKey(getHttpStatus(response));
    const message =
      deniedKey === 'errors.api.unauthorized' || deniedKey === 'errors.api.forbidden'
        ? t(deniedKey)
        : correlationId
          ? t('errors.api.unknownWithCorrelation', { correlationId })
          : t('errors.api.unknown');
    return { message, correlationId };
  }

  if (
    getHttpStatus(response) === 409 &&
    isRecord(data) &&
    Array.isArray(data.availableSlots)
  ) {
    return {
      message: t('errors.api.validation.appointmentConflict'),
      correlationId,
    };
  }

  const statusKey = getStatusKey(getHttpStatus(response));
  if (statusKey) return { message: t(statusKey), correlationId };

  return {
    message: correlationId
      ? t('errors.api.unknownWithCorrelation', { correlationId })
      : t('errors.api.unknown'),
    correlationId,
  };
}

/**
 * Localized API error.
 *
 * Carries a stable i18n `key` (and optional interpolation `params`) so
 * callers can render a translated, user-facing message instead of leaking
 * raw server/internal error text into the UI. `message` still holds a safe
 * English fallback so any caller that hasn't migrated to `getErrorMessage`
 * keeps its previous behavior.
 */
export class ApiError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor(key: string, fallbackMessage: string, params?: Record<string, string | number>) {
    super(fallbackMessage);
    this.name = 'ApiError';
    this.key = key;
    this.params = params;
  }
}

/**
 * Resolve a user-facing, translated message for a thrown error.
 * Falls back to a generic translated message rather than echoing
 * unknown/raw error text (which may be untranslated server internals).
 */
export function getErrorMessage(
  error: unknown,
  t: Translate,
): string {
  return translateApiError(error, t).message;
}
