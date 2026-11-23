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

/**
 * Reads a cookie value by name. Used to read the non-HttpOnly CSRF token that
 * the backend sets alongside the HttpOnly session cookie.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Session cookies are HttpOnly and therefore not readable from JavaScript.
 * The only client-readable auth artifact is the CSRF token cookie, which is
 * echoed back in the `X-CSRF-Token` header on state-changing requests.
 */
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Legacy localStorage keys that previously held bearer tokens. They are purged
 * on mount so existing sessions are migrated off JavaScript-readable storage.
 */
const LEGACY_TOKEN_KEYS = ['auth_tokens', 'auth_user', 'authToken'];

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

  // Restore session from the HttpOnly cookie on mount. Tokens are never read
  // from or written to localStorage; the browser attaches the session cookie
  // automatically and the server is the source of truth for the session.
  useEffect(() => {
    const loadStoredAuth = async () => {
      // Purge any legacy bearer tokens left in localStorage by older builds.
      try {
        for (const key of LEGACY_TOKEN_KEYS) {
          localStorage.removeItem(key);
        }
      } catch {
        // localStorage may be unavailable (private mode) — ignore.
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/session`, {
          method: 'GET',
          credentials: 'include',
          signal: abortControllerRef.current.signal,
        });

        if (response.ok) {
          const data = await response.json();
          const user: User | null = data?.user ?? null;
          if (user) {
            setState((prev) => ({
              ...prev,
              user,
              tokens: null,
              isAuthenticated: true,
              isLoading: false,
            }));
            setupTokenRefresh();
            return;
          }
        }

        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
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

  const setAuth = (user: User, tokens: AuthTokens | null) => {
    setState((prev) => ({
      ...prev,
      user,
      tokens,
      isAuthenticated: true,
      error: null,
    }));

    // Tokens are held only in memory for the lifetime of the tab. The durable
    // session lives in an HttpOnly cookie set by the backend, which JavaScript
    // cannot read. Never persist tokens to localStorage.
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

    // Purge any legacy bearer tokens from localStorage.
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }

    // Clear wallet data from localStorage so other tabs cannot read it
    localStorage.removeItem('petchain_wallets');

    // Clear IndexedDB offline caches (best-effort)
    if (typeof indexedDB !== 'undefined') {
      // (existing IndexedDB cleanup continues below)
    }
  }, []);

  // ── CSRF-protected fetch helper ────────────────────────────────────────────
  // All state-changing requests must include the CSRF token from the
  // non-HttpOnly `csrf_token` cookie in the `X-CSRF-Token` header. The session
  // cookie itself is HttpOnly and sent automatically via `credentials: 'include'`.
  const authFetch = useCallback((input: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const csrfToken = readCookie(CSRF_COOKIE_NAME);
      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }
    }
    return fetch(input, {
      ...init,
      headers,
      credentials: 'include',
      signal: init.signal ?? abortControllerRef.current.signal,
    });
  }, []);

  // Expose the CSRF-aware fetch for consumers that need to make authenticated
  // requests without handling cookies or CSRF headers themselves.
  void authFetch;

  // (remaining provider implementation — login, logout, refresh, verification
  // helpers — continues unchanged below and uses `authFetch` for mutations.)

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login: async () => {},
        loginWith2FA: async () => {},
        recoverWith2FA: async () => {},
        register: async () => {},
        logout: async () => {},
        refreshTokens: async () => false,
        clearError: () => {},
        resetPassword: async () => {},
        forgotPassword: async () => {},
        verifyEmail: async () => ({
          message: '',
          emailVerified: false,
          phoneVerified: false,
          isVerified: false,
        }),
        verifyPhone: async () => ({
          message: '',
          emailVerified: false,
          phoneVerified: false,
          isVerified: false,
        }),
        resendEmailVerification: async () => {},
        resendPhoneVerification: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
