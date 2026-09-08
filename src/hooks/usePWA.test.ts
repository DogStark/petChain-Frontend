import { renderHook, waitFor } from '@testing-library/react';
import { usePWA } from './usePWA';

describe('usePWA - Logging Behavior', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Mock navigator.serviceWorker
    const mockServiceWorker = {
      register: jest.fn(),
      addEventListener: jest.fn(),
      controller: null,
    };

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        onLine: true,
        serviceWorker: mockServiceWorker,
      },
      configurable: true,
      writable: true,
    });

    // Mock window
    Object.defineProperty(global, 'window', {
      value: {
        ...originalWindow,
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;

    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });

    Object.defineProperty(global, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });

  describe('SW registration error logging', () => {
    it('should log SW registration errors in development', async () => {
      process.env.NODE_ENV = 'development';
      const testError = new Error('Registration failed');

      (global.navigator.serviceWorker.register as jest.Mock).mockRejectedValue(testError);

      renderHook(() => usePWA());

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('[PWA] SW registration failed:', testError);
      });
    });

    it('should NOT log SW registration errors in production', async () => {
      process.env.NODE_ENV = 'production';
      const testError = new Error('Registration failed');

      (global.navigator.serviceWorker.register as jest.Mock).mockRejectedValue(testError);

      renderHook(() => usePWA());

      await waitFor(() => {
        expect(global.navigator.serviceWorker.register).toHaveBeenCalled();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Background sync logging', () => {
    it('should log background sync completion in development', async () => {
      process.env.NODE_ENV = 'development';
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      (global.navigator.serviceWorker.addEventListener as jest.Mock).mockImplementation(
        (event: string, handler: (event: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandler = handler;
          }
        }
      );

      (global.navigator.serviceWorker.register as jest.Mock).mockResolvedValue({
        addEventListener: jest.fn(),
      });

      renderHook(() => usePWA());

      await waitFor(() => {
        expect(global.navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        );
      });

      // Simulate background sync message
      if (messageHandler) {
        messageHandler({
          data: { type: 'BACKGROUND_SYNC_COMPLETE' },
        } as MessageEvent);
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('[PWA] Background sync completed');
    });

    it('should NOT log background sync completion in production', async () => {
      process.env.NODE_ENV = 'production';
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      (global.navigator.serviceWorker.addEventListener as jest.Mock).mockImplementation(
        (event: string, handler: (event: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandler = handler;
          }
        }
      );

      (global.navigator.serviceWorker.register as jest.Mock).mockResolvedValue({
        addEventListener: jest.fn(),
      });

      renderHook(() => usePWA());

      await waitFor(() => {
        expect(global.navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        );
      });

      // Simulate background sync message
      if (messageHandler) {
        messageHandler({
          data: { type: 'BACKGROUND_SYNC_COMPLETE' },
        } as MessageEvent);
      }

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log for non-sync messages in any environment', async () => {
      process.env.NODE_ENV = 'development';
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      (global.navigator.serviceWorker.addEventListener as jest.Mock).mockImplementation(
        (event: string, handler: (event: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandler = handler;
          }
        }
      );

      (global.navigator.serviceWorker.register as jest.Mock).mockResolvedValue({
        addEventListener: jest.fn(),
      });

      renderHook(() => usePWA());

      await waitFor(() => {
        expect(global.navigator.serviceWorker.addEventListener).toHaveBeenCalled();
      });

      // Simulate different message type
      if (messageHandler) {
        messageHandler({
          data: { type: 'OTHER_MESSAGE' },
        } as MessageEvent);
      }

      expect(consoleLogSpy).not.toHaveBeenCalledWith('[PWA] Background sync completed');
    });
  });
});
