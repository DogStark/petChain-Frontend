import { apiClient } from './client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthSession {
  tokens: AuthTokens;
  user: AuthUser;
}

/**
 * Monotonic generation counter used to invalidate in-flight refresh requests.
 *
 * A refresh request captures the generation at the moment it starts. When the
 * response arrives, callers compare the captured generation against the
 * current one; if they differ (logout or account switch happened in between),
 * the response is considered stale and must be discarded instead of being
 * written back into auth state.
 */
let authGeneration = 0;

export function getAuthGeneration(): number {
  return authGeneration;
}

/**
 * Invalidate any in-flight refresh requests. Called on logout and whenever the
 * active account changes so stale responses cannot restore a dead session.
 */
export function bumpAuthGeneration(): number {
  authGeneration += 1;
  return authGeneration;
}

export function isAuthGenerationCurrent(generation: number): boolean {
  return generation === authGeneration;
}

export interface RefreshResult {
  session: AuthSession;
  generation: number;
}

/**
 * Request a token refresh. The returned `generation` must be checked with
 * `isAuthGenerationCurrent` before the session is committed to state.
 */
export async function refreshSession(): Promise<RefreshResult> {
  const generation = getAuthGeneration();
  const response = await apiClient.post<AuthSession>('/auth/refresh');
  return { session: response.data, generation };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await apiClient.post<AuthSession>('/auth/login', { email, password });
  return response.data;
}

export async function logout(): Promise<void> {
  bumpAuthGeneration();
  await apiClient.post('/auth/logout');
}
