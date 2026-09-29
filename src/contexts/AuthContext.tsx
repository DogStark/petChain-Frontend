import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getApiBaseUrl } from '../lib/api/apiBaseUrl';
import { twoFactorAPI } from '../lib/api/twoFactorAPI';

export type UserRole = 'user' | 'admin' | 'moderator';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isVerified: boolean;
  isActive: boolean;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWith2FA: (email: string, password: string, totpToken: string) => Promise<void>;
  recoverWith2FA: (email: string, password: string, backupCode: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  clearError: () => void;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<{
    message: string;
    email?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    isVerified: boolean;
  }>;
  verifyPhone: (
    email: string,
    code: string
  ) => Promise<{
    message: string;
    email?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    isVerified: boolean;
  }>;
  resendEmailVerification: (email: string) => Promise<void>;
  resendPhoneVerification: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const API_BASE_URL = getApiBaseUrl();

/**
 * Combines multiple AbortSignals into one. The returned signal is aborted when
 * ANY of the input signals are aborted. Useful for merging a per-request signal
 * with a session-level signal.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Cross-tab logout signal (BroadcastChannel) ─────────────────────────────
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const router = useRouter();

  // ── Abort in-flight requests on logout ─────────────────────────────────────
  const abortControllerRef = useRef<AbortController>(new AbortController());

  // Load tokens from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = () => {
      try {
        const storedTokens = localStorage.getItem('auth_tokens');
        const storedUser = localStorage.getItem('auth_user');

        if (storedTokens && storedUser) {
          const tokens = JSON.parse(storedTokens);
          const user = JSON.parse(storedUser);

          setState((prev) => ({
            ...prev,
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          }));

          // Set up automatic token refresh
          setupTokenRefresh();
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadStoredAuth();

    // ── Cross-tab logout via BroadcastChannel ─────────────────────────────
    try {
      const channel = new BroadcastChannel('petchain-auth');
      broadcastChannelRef.current = channel;
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'LOGOUT') {
          forceLogout('Signed out in another tab or window.');
        }
      });
    } catch {
      // BroadcastChannel not supported (e.g. older browsers) — fall back to storage event
    }

    // ── Cross-tab logout via localStorage 'storage' event ──────────────────
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === 'auth_tokens' ||
        event.key === 'auth_user' ||
        event.key === 'authToken'
      ) {
        // If the key was removed (or set to null), another tab logged out.
        if (event.newValue === null) {
          const tokensStillPresent = localStorage.getItem('auth_tokens');
          if (!tokensStillPresent) {
            forceLogout('Session ended in another window.');
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // ── Service-worker logout signal (SW_CACHE_CLEARED / LOGOUT) ────────────
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_CACHE_CLEARED') {
        // The SW purged its caches; verify this tab still has a session.
        const storedTokens = localStorage.getItem('auth_tokens');
        if (!storedTokens) {
          // Session was already cleared — another tab handled the logout.
          forceLogout('Session cache cleared by service worker.');
        }
      }
      // Direct LOGOUT from the service worker (broadcast to all clients)
      if (event.data?.type === 'LOGOUT') {
        forceLogout('Signed out in another tab or window.');
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      clearTokenRefresh();
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      window.removeEventListener('storage', handleStorageChange);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  const setAuth = (user: User, tokens: AuthTokens) => {
    setState((prev) => ({
      ...prev,
      user,
      tokens,
      isAuthenticated: true,
      error: null,
    }));

    // Store in localStorage
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('authToken', tokens.accessToken);

    setupTokenRefresh();
  };

  const clearAuth = useCallback(() => {
    // Abort any in-flight requests so stale responses cannot restore the session
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setState((prev) => ({
      ...prev,
      user: null,
      tokens: null,
      isAuthenticated: false,
      error: null,
    }));

    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('authToken');

    // Clear wallet data from localStorage so other tabs cannot read it
    localStorage.removeItem('petchain_wallets');

    // Clear IndexedDB offline caches (best-effort)
    if (typeof indexedDB !== 'undefined') {
      try {
        indexedDB.deleteDatabase('petchain-offline');
      } catch {
        // Non-critical; cache will expire naturally
      }
    }

    clearTokenRefresh();
  }, []);

  /**
   * Called when a cross-tab or service-worker signal indicates the session has
   * ended. Clears auth state and redirects to a safe public route.
   */
  const forceLogout = useCallback(
    (reason: string) => {
      clearAuth();

      if (typeof window !== 'undefined') {
        showLogoutWarning(reason);

        // Navigate to login, preserving a safe redirect if the current page
        // is a protected route. Public routes (/, /login, /register, etc.)
        // remain visible.
        const currentPath = window.location.pathname;
        const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/offline'];
        if (!publicRoutes.includes(currentPath)) {
          router.push(`/login?next=${encodeURIComponent(currentPath)}`);
        }
      }
    },
    [clearAuth, router]
  );

  const setError = (error: string) => {
    setState((prev) => ({ ...prev, error }));
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const setLoading = (isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  };

  const showLogoutWarning = (message: string) => {
    if (typeof window === 'undefined') {
      console.warn(message);
      return;
    }

    const bannerId = 'auth-logout-warning-banner';
    const existingBanner = document.getElementById(bannerId);
    existingBanner?.remove();

    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    banner.style.position = 'fixed';
    banner.style.bottom = '1rem';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.maxWidth = 'min(92vw, 32rem)';
    banner.style.padding = '0.875rem 1rem';
    banner.style.borderRadius = '0.75rem';
    banner.style.backgroundColor = '#fef3c7';
    banner.style.color = '#92400e';
    banner.style.border = '1px solid #f59e0b';
    banner.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.16)';
    banner.style.zIndex = '99999';
    banner.style.fontSize = '0.95rem';
    banner.style.lineHeight = '1.4';
    banner.textContent = message;

    document.body.appendChild(banner);
    window.setTimeout(() => banner.remove(), 8000);
  };

  const setupTokenRefresh = () => {
    clearTokenRefresh();

    // Refresh token 2 minutes before expiry (access token expires in 15 minutes)
    const refreshInterval = 13 * 60 * 1000; // 13 minutes

    refreshTimerRef.current = setInterval(() => {
      refreshTokens();
    }, refreshInterval);
  };

  const clearTokenRefresh = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;

    // Merge the caller's signal (if any) with the session abort controller so
    // that clearAuth() cancels all in-flight requests, preventing stale
    // responses from restoring the session.
    const sessionSignal = abortControllerRef.current.signal;
    const combinedSignal = options.signal
      ? anySignal([options.signal, sessionSignal])
      : sessionSignal;

    const config: RequestInit = {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      signal: combinedSignal,
      body: options.body,
      cache: options.cache,
      credentials: options.credentials,
      mode: options.mode,
      redirect: options.redirect,
      referrer: options.referrer,
      integrity: options.integrity,
      keepalive: options.keepalive,
      window: options.window,
    };

    // Add auth header if we have a token
    if (state.tokens?.accessToken) {
      (config.headers as Record<string, string>).Authorization = `Bearer ${state.tokens.accessToken}`;
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.requires2FA) {
        throw new Error('2FA_REQUIRED');
      }

      setAuth(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      // Preserve the 2FA sentinel so the caller can branch on it; normalise everything else
      // to avoid leaking account-state details (user enumeration).
      setError(message === '2FA_REQUIRED' ? message : 'Invalid email or password. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWith2FA = async (
    email: string,
    password: string,
    totpToken: string
  ): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await twoFactorAPI.verify(email, password, totpToken);
      setAuth(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '2FA verification failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const recoverWith2FA = async (
    email: string,
    password: string,
    backupCode: string
  ): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await twoFactorAPI.recover(email, password, backupCode);
      setAuth(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Recovery failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string
  ): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      await makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName, phone }),
      });

      // Registration doesn't return tokens, just user data
      // User needs to verify email before logging in
      setState((prev) => ({ ...prev, error: null }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);

    // ── Cross-tab logout signal ─────────────────────────────────────────────
    // Tell every other tab to exit protected routes immediately. This must
    // happen BEFORE the server call so that sibling tabs see the signal even
    // if the network is slow or unavailable.
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'LOGOUT' });
    }

    const refreshToken = state.tokens?.refreshToken;
    let serverLogoutSucceeded = !refreshToken; // no token = nothing to revoke

    if (refreshToken) {
      // Attach the current abort signal so in-flight requests are cancelled
      // when clearAuth() fires (which aborts the controller).
      const signal = abortControllerRef.current.signal;

      // Attempt server-side revocation with one retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await makeRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
            signal,
          });
          serverLogoutSucceeded = true;
          break;
        } catch (error) {
          console.error(`Logout attempt ${attempt + 1} failed:`, error);
        }
      }
    }

    clearAuth();
    setLoading(false);

    // Tell the service worker to purge its user-scoped cache so that
    // authenticated API responses (health, wallet, account) cannot bleed
    // into the next session on this device.
    if (typeof window !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SW_LOGOUT' });
    }

    if (!serverLogoutSucceeded) {
      showLogoutWarning(
        "You've been signed out on this device, but we couldn't confirm the session was closed on our server. If this device may be compromised, consider changing your password."
      );
    }
  };

  const refreshTokens = async (): Promise<boolean> => {
    if (!state.tokens?.refreshToken) {
      clearAuth();
      return false;
    }

    try {
      const data = await makeRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
      });

      setAuth(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearAuth();
      return false;
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      await makeRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      await makeRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Password reset failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (
    token: string
  ): Promise<{
    message: string;
    email?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    isVerified: boolean;
  }> => {
    setLoading(true);
    clearError();

    try {
      return await makeRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Email verification failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhone = async (
    email: string,
    code: string
  ): Promise<{
    message: string;
    email?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    isVerified: boolean;
  }> => {
    setLoading(true);
    clearError();

    try {
      return await makeRequest('/auth/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Phone verification failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resendEmailVerification = async (email: string): Promise<void> => {
    await makeRequest('/auth/resend-email-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  const resendPhoneVerification = async (email: string): Promise<void> => {
    await makeRequest('/auth/resend-phone-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  const value: AuthContextType = {
    ...state,
    login,
    loginWith2FA,
    recoverWith2FA,
    register,
    logout,
    refreshTokens,
    clearError,
    resetPassword,
    forgotPassword,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
