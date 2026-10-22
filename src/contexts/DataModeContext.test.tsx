import { renderHook, act } from '@testing-library/react';
import { DataModeProvider, useDataMode } from './DataModeContext';
import React from 'react';

describe('DataModeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataModeProvider>{children}</DataModeProvider>
  );

  describe('Initial State', () => {
    it('should initialize with full mode by default', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      expect(result.current.mode).toBe('full');
      expect(result.current.isReducedMode).toBe(false);
    });

    it('should load mode from localStorage if available', () => {
      localStorage.setItem('petchain-data-mode', 'reduced');

      const { result } = renderHook(() => useDataMode(), { wrapper });

      expect(result.current.mode).toBe('reduced');
      expect(result.current.isReducedMode).toBe(true);
    });

    it('should ignore invalid localStorage values', () => {
      localStorage.setItem('petchain-data-mode', 'invalid-mode');

      const { result } = renderHook(() => useDataMode(), { wrapper });

      expect(result.current.mode).toBe('full');
      expect(result.current.isReducedMode).toBe(false);
    });
  });

  describe('setMode', () => {
    it('should update mode state', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.setMode('reduced');
      });

      expect(result.current.mode).toBe('reduced');
      expect(result.current.isReducedMode).toBe(true);
    });

    it('should persist mode to localStorage', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.setMode('reduced');
      });

      expect(localStorage.getItem('petchain-data-mode')).toBe('reduced');
    });

    it('should handle localStorage errors gracefully', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useDataMode(), { wrapper });

      // Should not throw
      act(() => {
        result.current.setMode('reduced');
      });

      expect(result.current.mode).toBe('reduced');
      setItemSpy.mockRestore();
    });
  });

  describe('toggleMode', () => {
    it('should toggle from full to reduced', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.toggleMode();
      });

      expect(result.current.mode).toBe('reduced');
      expect(result.current.isReducedMode).toBe(true);
    });

    it('should toggle from reduced to full', () => {
      localStorage.setItem('petchain-data-mode', 'reduced');
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.toggleMode();
      });

      expect(result.current.mode).toBe('full');
      expect(result.current.isReducedMode).toBe(false);
    });

    it('should persist toggled mode to localStorage', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.toggleMode();
      });

      expect(localStorage.getItem('petchain-data-mode')).toBe('reduced');

      act(() => {
        result.current.toggleMode();
      });

      expect(localStorage.getItem('petchain-data-mode')).toBe('full');
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage read errors', () => {
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const { result } = renderHook(() => useDataMode(), { wrapper });

      expect(result.current.mode).toBe('full');
      getItemSpy.mockRestore();
    });
  });

  describe('useDataMode Hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDataMode());
      }).toThrow('useDataMode must be used within a DataModeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Privacy Compliance', () => {
    it('should store preference locally only', () => {
      const { result } = renderHook(() => useDataMode(), { wrapper });

      act(() => {
        result.current.setMode('reduced');
      });

      // Verify it's in localStorage (client-side only)
      expect(localStorage.getItem('petchain-data-mode')).toBe('reduced');

      // Setting mode should not involve any network requests
      // The preference stays purely client-side
    });
  });
});
