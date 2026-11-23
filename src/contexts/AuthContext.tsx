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

  // ── Session generation guard ───────────────────────────────────────────────
  // Incremented on every logout and account switch. Any async refresh that
  // resolves after the generation has changed is stale and must be discarded
  // so it cannot restore a logged-out session or overwrite a new account.
  const sessionGenerationRef = useRef(0);

  const bumpSessionGeneration = useCallback(() => {
    sessionGenerationRef.current += 1;
    return sessionGenerationRef.current;
  }, []);

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
    // A new account/session is being established — invalidate any in-flight
    // refresh that belongs to the previous session.
    bumpSessionGeneration();

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
    // Invalidate any in-flight refresh so its response cannot restore the session
    bumpSessionGeneration();

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
        // ignore
      }
    }
  }, [bumpSessionGeneration]);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const currentTokens = state.tokens;
    if (!currentTokens?.refreshToken) {
      return false;
    }

    // Capture the generation this refresh belongs to. If logout or an account
    // switch happens while the request is in flight, the generation will have
    // changed and the response must be discarded.
    const generation = sessionGenerationRef.current;
    const isStale = () => sessionGenerationRef.current !== generation;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
        signal: anySignal([abortControllerRef.current.signal]),
      });

      if (isStale()) {
        return false;
      }

      if (!response.ok) {
        // Refresh failed (e.g. token expired) — clear the session.
        clearAuth();
        return false;
      }

      const data = await response.json();

      // Re-check after parsing: logout/account switch may have happened while
      // the body was being read.
      if (isStale()) {
        return false;
      }

      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? currentTokens.refreshToken,
      };

      setState((prev) => {
        if (sessionGenerationRef.current !== generation) {
          return prev;
        }
        return { ...prev, tokens: newTokens, isAuthenticated: true };
      });

      if (sessionGenerationRef.current !== generation) {
        return false;
      }

      localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
      localStorage.setItem('authToken', newTokens.accessToken);

      setupTokenRefresh();
      return true;
    } catch (error) {
      // Aborted requests are expected on logout — do not surface them.
      if (isStale()) {
        return false;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
      console.error('Error refreshing tokens:', error);
      return false;
    }
  }, [state.tokens, clearAuth]);

  const clearTokenRefresh = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const setupTokenRefresh = () => {
    clearTokenRefresh();
    // Refresh 1 minute before the access token expires (assumes 15m tokens).
    refreshTimerRef.current = setTimeout(() => {
      void refreshTokens();
    }, 14 * 60 * 1000);
  };

  const forceLogout = (message: string) => {
    clearTokenRefresh();
    clearAuth();
    setState((prev) => ({ ...prev, error: message }));
    void router.push('/login');
  };

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      setAuth(data.user, data.tokens);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  };

  const loginWith2FA = async (email: string, password: string, totpToken: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await twoFactorAPI.verifyLogin(email, password, totpToken);
      setAuth(data.user, data.tokens);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  };

  const recoverWith2FA = async (email: string, password: string, backupCode: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await twoFactorAPI.recoverLogin(email, password, backupCode);
      setAuth(data.user, data.tokens);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string
  ) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, phone }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      setAuth(data.user, data.tokens);
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }));
      throw error;
    }
  };

  const logout = async () => {
    clearTokenRefresh();
    try {
      if (state.tokens?.refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      clearAuth();
      try {
        broadcastChannelRef.current?.postMessage({ type: 'LOGOUT' });
      } catch {
        // ignore
      }
      void router.push('/login');
    }
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Password reset failed');
    }
  };

  const forgotPassword = async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send reset email');
    }
  };

  const verifyEmail = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Email verification failed');
    }
    return response.json();
  };

  const verifyPhone = async (email: string, code: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Phone verification failed');
    }
    return response.json();
  };

  const resendEmailVerification = async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-email-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to resend verification email');
    }
  };

  const resendPhoneVerification = async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-phone-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to resend verification code');
    }
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

export default AuthContext;
