import axios, { type AxiosError } from 'axios';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    if (messages.length > 0) return messages.join(', ');
  }
  if (isRecord(value) && typeof value.message === 'string' && value.message.trim()) {
    return value.message;
  }
  return undefined;
}

/** Return a display-safe message without assuming a thrown value's shape. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<unknown>(error)) {
    const responseMessage = messageFromUnknown(error.response?.data);
    if (responseMessage) return responseMessage;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return messageFromUnknown(error) ?? fallback;
}

/** Read an HTTP status only from an Axios error response. */
export function getHttpStatus(error: unknown): number | undefined {
  return axios.isAxiosError<unknown>(error) ? error.response?.status : undefined;
}

/** Convert JSON error bodies returned as blobs back to their typed unknown value. */
export async function parseBlobError(error: AxiosError<unknown>): Promise<never> {
  const response = error.response;
  const data = response?.data;
  const contentType = String(response?.headers?.['content-type'] ?? '');

  if (response && typeof Blob !== 'undefined' && data instanceof Blob && contentType.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(await data.text());
      response.data = parsed;
      error.message = messageFromUnknown(parsed) ?? error.message;
    } catch {
      // Preserve the original HTTP error when the response body is not valid JSON.
    }
  }

  return Promise.reject(error);
}
