import http from 'k6/http';
import { check } from 'k6';
import { getApiUrl } from '../config/test-config';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): AuthTokens | null {
  const payload = JSON.stringify({
    email,
    password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(getApiUrl('/auth/login'), payload, params);
  
  check(response, {
    'login successful': (r) => r.status === 200 || r.status === 201,
    'has access token': (r) => r.json('accessToken') !== undefined,
  });

  if (response.status === 200 || response.status === 201) {
    const body = response.json() as any;
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }
  
  return null;
}

export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export function refreshToken(refreshToken: string): string | null {
  const payload = JSON.stringify({
    refreshToken,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(getApiUrl('/auth/refresh'), payload, params);
  
  if (response.status === 200 || response.status === 201) {
    return response.json('accessToken') as string;
  }
  
  return null;
}
