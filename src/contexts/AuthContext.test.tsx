import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  emailVerified: true,
  phoneVerified: true,
  isVerified: true,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('login', () => {
    it('sets user and tokens on successful login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.tokens?.accessToken).toBe('access-token');
    });

    it('stores all three localStorage keys on login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(localStorage.getItem('auth_tokens')).not.toBeNull();
      expect(localStorage.getItem('auth_user')).not.toBeNull();
      expect(localStorage.getItem('authToken')).toBe('access-token');
    });

    it('sets error and throws on failed login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(result.current.login('test@example.com', 'wrong')).rejects.toThrow();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('clears all three localStorage keys on logout', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser, ...mockTokens }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(localStorage.getItem('auth_tokens')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('clears auth even when logout API call fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser, ...mockTokens }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Server error' }),
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('refreshTokens', () => {
    it('updates tokens on successful refresh', async () => {
      const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser, ...mockTokens }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser, ...newTokens }),
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.refreshTokens();
      });

      expect(success!).toBe(true);
      expect(result.current.tokens?.accessToken).toBe('new-access');
    });

    it('clears auth and returns false when refresh fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser, ...mockTokens }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Refresh token expired' }),
        });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.refreshTokens();
      });

      expect(success!).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('recoverWith2FA', () => {
    it('sets user and tokens on successful 2FA recovery', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.recoverWith2FA('test@example.com', 'password123', 'BACKUP-CODE');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('sets error on failed 2FA recovery', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid backup code' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(
          result.current.recoverWith2FA('test@example.com', 'password123', 'WRONG')
        ).rejects.toThrow();
      });

      expect(result.current.error).toBe('Invalid backup code');
    });
  });
});
