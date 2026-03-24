const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

export function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, '');
  if (/\/api\/v\d+$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl;
  }

  if (/\/api$/i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/v1`;
  }

  return `${normalizedBaseUrl}/api/v1`;
}
