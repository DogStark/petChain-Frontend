import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    return () => {
      clearTokenRefresh();
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

  const clearAuth = () => {
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
    clearTokenRefresh();
  };

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

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth header if we have a token
    if (state.tokens?.accessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${state.tokens.accessToken}`,
      };
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

    const refreshToken = state.tokens?.refreshToken;
    let serverLogoutSucceeded = !refreshToken; // no token = nothing to revoke

    if (refreshToken) {
      // Attempt server-side revocation with one retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await makeRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
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
