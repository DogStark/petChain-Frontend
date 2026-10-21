import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

import { translateApiError } from './apiError';

type LocaleMessages = Record<string, unknown>;

function createTranslator(locale: LocaleMessages) {
  return (key: string, params?: Record<string, string | number>) => {
    let value: unknown = locale;
    for (const part of key.split('.')) {
      if (typeof value !== 'object' || value === null) return key;
      value = (value as Record<string, unknown>)[part];
    }

    if (typeof value !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
      (message, [name, param]) => message.replaceAll(`{{${name}}}`, String(param)),
      value,
    );
  };
}

describe('translateApiError', () => {
  it('translates known validation codes in English and French', () => {
    const error = { response: { data: { code: 'PET_NAME_REQUIRED' } } };
    const english = translateApiError(error, createTranslator(en));
    const french = translateApiError(error, createTranslator(fr));

    expect(english.message).toBe('Pet name is required.');
    expect(french.message).toBe("Le nom de l'animal est obligatoire.");
  });

  it('translates known service codes without exposing server messages', () => {
    const result = translateApiError(
      {
        response: {
          data: {
            code: 'FORBIDDEN',
            message: 'User 123 cannot view confidential record',
          },
        },
      },
      createTranslator(en),
    );

    expect(result.message).toBe("You don't have permission to perform this action.");
    expect(result.message).not.toContain('confidential');
  });

  it('returns a generic translated message and safe correlation ID for unknown codes', () => {
    const result = translateApiError(
      {
        response: {
          data: {
            code: 'UNKNOWN_SERVER_CODE',
            message: 'secret details and a stack trace',
            correlation_id: 'ec-public-safe-123abc',
          },
        },
      },
      createTranslator(en),
    );

    expect(result.message).toContain('ec-public-safe-123abc');
    expect(result.message).not.toContain('secret details');
    expect(result.correlationId).toBe('ec-public-safe-123abc');
  });

  it('reads a correlation ID from response headers', () => {
    const result = translateApiError(
      {
        response: {
          data: { code: 'UNKNOWN_SERVER_CODE' },
          headers: { 'X-Correlation-Id': 'ec-server-header-123' },
        },
      },
      createTranslator(en),
    );

    expect(result.correlationId).toBe('ec-server-header-123');
    expect(result.message).toContain('ec-server-header-123');
  });

  it.each([
    ['missing code', { response: { data: { message: 'private response detail' } } }],
    ['empty code', { response: { status: 400, data: { code: '  ', message: 'private detail' } } }],
    ['missing correlation ID', { response: { data: { code: 'FUTURE_CODE' } } }],
    ['null', null],
    ['undefined', undefined],
    ['string', 'server supplied private details'],
    ['number', 502],
    ['boolean', false],
    ['malformed response', { response: null }],
  ])('handles %s without exposing raw error data', (_name, error) => {
    const result = translateApiError(error, createTranslator(en));

    expect(result.message).toBe(en.errors.api.unknown);
    expect(result.message).not.toContain('private');
    expect(result.correlationId).toBeNull();
  });

  it('uses the safe network message for network failures', () => {
    const result = translateApiError(
      {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'request included private details',
      },
      createTranslator(en),
    );

    expect(result.message).toBe(en.errors.api.network);
    expect(result.message).not.toContain('private');
  });

  it.each([
    [401, 'errors.api.unauthorized'],
    [403, 'errors.api.forbidden'],
  ])('returns a safe translated message for denied status %s', (status, key) => {
    const result = translateApiError(
      {
        response: {
          status,
          data: { message: 'access token and personal information' },
        },
      },
      createTranslator(en),
    );

    expect(result.message).toBe(createTranslator(en)(key));
    expect(result.message).not.toContain('token');
    expect(result.message).not.toContain('personal');
  });

  it('does not display unsafe correlation IDs', () => {
    const result = translateApiError(
      {
        response: {
          data: {
            code: 'FUTURE_CODE',
            correlationId: 'owner@example.com',
          },
        },
      },
      createTranslator(en),
    );

    expect(result.correlationId).toBeNull();
    expect(result.message).toBe(en.errors.api.unknown);
    expect(result.message).not.toContain('owner@example.com');
  });
});
