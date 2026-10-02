import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { attachCorrelationHeader, type RouteGroup } from '@/lib/errorCorrelation';

/**
 * Register a request interceptor that stamps every outgoing request with an
 * `X-Correlation-Id`. If a boundary error is triggered by the same interaction,
 * the server-side log entry and the client-side error report share the ID.
 *
 * Safe to call multiple times on the same instance — a re-registered
 * interceptor replaces the stamped header value, never duplicating.
 */
export function attachCorrelationInterceptor(api: AxiosInstance, group: RouteGroup = 'server'): void {
  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const headers = attachCorrelationHeader(
      config.headers as unknown as Record<string, string> | undefined,
      group,
    );
    config.headers = headers as unknown as InternalAxiosRequestConfig['headers'];
    return config;
  });
}
