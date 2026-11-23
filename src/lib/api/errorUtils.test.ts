import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { getErrorMessage, getHttpStatus, parseBlobError } from './errorUtils';

describe('API boundary error utilities', () => {
  it('uses safe messages for Error, unknown, and malformed response values', () => {
    expect(getErrorMessage(new Error('network unavailable'), 'Request failed')).toBe(
      'network unavailable',
    );
    expect(getErrorMessage({ message: { private: true } }, 'Request failed')).toBe(
      'Request failed',
    );
    expect(getErrorMessage(null, 'Request failed')).toBe('Request failed');
  });

  it('reads HTTP status and API message only from an Axios error with validated data', () => {
    const response: AxiosResponse<unknown> = {
      data: { message: 'Access denied' },
      status: 401,
      statusText: 'Unauthorized',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    };
    const error = new AxiosError('Request failed', undefined, undefined, undefined, response);

    expect(getHttpStatus(error)).toBe(401);
    expect(getErrorMessage(error, 'Fallback')).toBe('Access denied');
    expect(getHttpStatus(new Error('not an HTTP error'))).toBeUndefined();
  });

  it('parses JSON Blob errors and preserves unparseable error responses', async () => {
    const response: AxiosResponse<unknown> = {
      data: new Blob(['{"message":"Invalid request"}'], { type: 'application/json' }),
      status: 400,
      statusText: 'Bad Request',
      headers: new AxiosHeaders({ 'content-type': 'application/json' }),
      config: { headers: new AxiosHeaders() },
    };
    const error = new AxiosError('Request failed', undefined, undefined, undefined, response);

    await expect(parseBlobError(error)).rejects.toBe(error);
    expect(error.message).toBe('Invalid request');
    expect(error.response?.data).toEqual({ message: 'Invalid request' });

    const invalidResponse: AxiosResponse<unknown> = {
      ...response,
      data: new Blob(['not-json'], { type: 'application/json' }),
    };
    const invalidError = new AxiosError(
      'Request failed',
      undefined,
      undefined,
      undefined,
      invalidResponse,
    );

    await expect(parseBlobError(invalidError)).rejects.toBe(invalidError);
    expect(invalidError.message).toBe('Request failed');
    expect(invalidError.response?.data).toBeInstanceOf(Blob);
  });
});
