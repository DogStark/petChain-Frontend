import { renderHook, act } from '@testing-library/react';
import { useUnitPreference } from '@/hooks/useUnitPreference';

describe('useUnitPreference', () => {
  let mockNavigator: Partial<Navigator>;
  
  beforeEach(() => {
    localStorage.clear();
    // Mock navigator.language
    mockNavigator = { language: 'en-US' };
    Object.defineProperty(window, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('locale defaults', () => {
    it('defaults to customary for en-US locale', () => {
      mockNavigator.language = 'en-US';
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('customary');
      expect(result.current.source).toBe('locale');
    });

    it('defaults to metric for non-US locales', () => {
      const testLocales = ['en-GB', 'fr-FR', 'de-DE', 'ja-JP', 'pt-BR'];
      
      testLocales.forEach((locale) => {
        localStorage.clear();
        mockNavigator.language = locale;
        const { result } = renderHook(() => useUnitPreference());
        
        expect(result.current.system).toBe('metric');
        expect(result.current.source).toBe('locale');
      });
    });

    it('defaults to metric when navigator.language is unavailable', () => {
      // Set a non-US locale since we can't truly delete navigator.language
      mockNavigator.language = 'en-GB';
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('metric');
      expect(result.current.source).toBe('locale');
    });
  });

  describe('explicit user override', () => {
    it('allows setting system to metric', () => {
      const { result } = renderHook(() => useUnitPreference());
      
      act(() => {
        result.current.setSystem('metric');
      });
      
      expect(result.current.system).toBe('metric');
      expect(result.current.source).toBe('user');
      expect(localStorage.getItem('petchain-unit-preference')).toBe('metric');
    });

    it('allows setting system to customary', () => {
      mockNavigator.language = 'ja-JP'; // Normally defaults to metric
      const { result } = renderHook(() => useUnitPreference());
      
      act(() => {
        result.current.setSystem('customary');
      });
      
      expect(result.current.system).toBe('customary');
      expect(result.current.source).toBe('user');
      expect(localStorage.getItem('petchain-unit-preference')).toBe('customary');
    });
  });

  describe('persistence', () => {
    it('loads persisted preference on mount', () => {
      localStorage.setItem('petchain-unit-preference', 'customary');
      mockNavigator.language = 'ja-JP'; // Locale default would be metric
      
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('customary');
      expect(result.current.source).toBe('user');
    });

    it('ignores invalid persisted values', () => {
      localStorage.setItem('petchain-unit-preference', 'invalid');
      mockNavigator.language = 'en-US';
      
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('customary'); // Falls back to locale default
      expect(result.current.source).toBe('locale');
    });

    it('ignores corrupted localStorage data', () => {
      localStorage.setItem('petchain-unit-preference', '{"broken": true}');
      mockNavigator.language = 'fr-FR';
      
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('metric'); // Falls back to locale default
      expect(result.current.source).toBe('locale');
    });

    it('handles localStorage unavailable (private browsing)', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });
      
      const { result } = renderHook(() => useUnitPreference());
      
      // Should not throw, should use locale default
      expect(() => {
        act(() => {
          result.current.setSystem('metric');
        });
      }).not.toThrow();
      
      expect(result.current.system).toBe('metric');
      expect(result.current.source).toBe('user');
      
      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('reset to locale', () => {
    it('resets from user preference to locale default', () => {
      mockNavigator.language = 'en-US';
      const { result } = renderHook(() => useUnitPreference());
      
      // Set user preference
      act(() => {
        result.current.setSystem('metric');
      });
      expect(result.current.system).toBe('metric');
      expect(result.current.source).toBe('user');
      
      // Reset to locale
      act(() => {
        result.current.resetToLocale();
      });
      expect(result.current.system).toBe('customary'); // US locale default
      expect(result.current.source).toBe('locale');
      expect(localStorage.getItem('petchain-unit-preference')).toBeNull();
    });

    it('resets correctly for metric locales', () => {
      mockNavigator.language = 'fr-FR';
      const { result } = renderHook(() => useUnitPreference());
      
      // Set user preference
      act(() => {
        result.current.setSystem('customary');
      });
      expect(result.current.system).toBe('customary');
      
      // Reset to locale
      act(() => {
        result.current.resetToLocale();
      });
      expect(result.current.system).toBe('metric'); // French locale default
      expect(result.current.source).toBe('locale');
    });
  });

  describe('SSR safety', () => {
    it('handles server-side rendering without window', () => {
      // Simulate SSR by checking initial state before effects run
      mockNavigator.language = 'en-US';
      const { result } = renderHook(() => useUnitPreference());
      
      // Hook should initialize without errors
      expect(result.current).toBeDefined();
      expect(result.current.system).toBeDefined();
      expect(result.current.setSystem).toBeDefined();
      expect(result.current.resetToLocale).toBeDefined();
    });

    it('does not cause hydration mismatch', () => {
      // First render (server)
      mockNavigator.language = 'en-US';
      const { result: serverResult, unmount } = renderHook(() => useUnitPreference());
      const serverSystem = serverResult.current.system;
      unmount();
      
      // Second render (client) with same conditions
      const { result: clientResult } = renderHook(() => useUnitPreference());
      const clientSystem = clientResult.current.system;
      
      // Should be consistent
      expect(clientSystem).toBe(serverSystem);
    });
  });

  describe('edge cases', () => {
    it('handles empty localStorage value', () => {
      localStorage.setItem('petchain-unit-preference', '');
      mockNavigator.language = 'de-DE';
      
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('metric'); // Falls back to locale
      expect(result.current.source).toBe('locale');
    });

    it('handles case-insensitive locale matching', () => {
      mockNavigator.language = 'EN-us'; // Mixed case
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('customary');
    });

    it('handles locale with region code', () => {
      mockNavigator.language = 'en-US-x-twain'; // With variant
      const { result } = renderHook(() => useUnitPreference());
      
      expect(result.current.system).toBe('customary');
    });
  });
});
