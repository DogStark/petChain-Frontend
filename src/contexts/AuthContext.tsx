import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  isActive: boolean;
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
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  clearError: () => void;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Load tokens from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = () => {
      try {
        const storedTokens = localStorage.getItem('auth_tokens');
        const storedUser = localStorage.getItem('auth_user');
        
        if (storedTokens && storedUser) {
          const tokens = JSON.parse(storedTokens);
          const user = JSON.parse(storedUser);
          
          setState(prev => ({
            ...prev,
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          }));
          
          // Set up automatic token refresh
          setupTokenRefresh();
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadStoredAuth();
  }, []);

  const setAuth = (user: User, tokens: AuthTokens) => {
    setState(prev => ({
      ...prev,
      user,
      tokens,
      isAuthenticated: true,
      error: null,
    }));
    
    // Store in localStorage
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    localStorage.setItem('auth_user', JSON.stringify(user));
    
    setupTokenRefresh();
  };

  const clearAuth = () => {
    setState(prev => ({
      ...prev,
      user: null,
      tokens: null,
      isAuthenticated: false,
      error: null,
    }));
    
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    clearTokenRefresh();
  };

  const setError = (error: string) => {
    setState(prev => ({ ...prev, error }));
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const setLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };

  let refreshTimer: NodeJS.Timeout | null = null;

  const setupTokenRefresh = () => {
    clearTokenRefresh();
    
    // Refresh token 2 minutes before expiry (access token expires in 15 minutes)
    const refreshInterval = 13 * 60 * 1000; // 13 minutes
    
    refreshTimer = setInterval(() => {
      refreshTokens();
    }, refreshInterval);
  };

  const clearTokenRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
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
        'Authorization': `Bearer ${state.tokens.accessToken}`,
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
      setError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWith2FA = async (email: string, password: string, totpToken: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await makeRequest('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ email, password, token: totpToken }),
      });

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

  const recoverWith2FA = async (email: string, password: string, backupCode: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await makeRequest('/auth/2fa/recover', {
        method: 'POST',
        body: JSON.stringify({ email, password, backupCode }),
      });

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
    lastName: string
  ): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      const data = await makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      // Registration doesn't return tokens, just user data
      // User needs to verify email before logging in
      setState(prev => ({ ...prev, error: null }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    
    try {
      if (state.tokens?.refreshToken) {
        await makeRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      setLoading(false);
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

  const verifyEmail = async (token: string): Promise<void> => {
    setLoading(true);
    clearError();

    try {
      await makeRequest('/auth/verify-email', {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};