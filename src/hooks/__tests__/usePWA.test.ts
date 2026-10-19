import { renderHook, act } from '@testing-library/react-hooks';
import { usePWA } from '../usePWA';

describe('usePWA rollback protection', () => {
  let originalNavigator: any;
  let originalWindowLocation: any;
  let mockPostMessage: jest.Mock;
  let mockUnregister: jest.Mock;

  beforeEach(() => {
    originalNavigator = global.navigator;
    originalWindowLocation = global.window.location;

    mockPostMessage = jest.fn();
    mockUnregister = jest.fn().mockResolvedValue(true);

    const mockServiceWorker = {
      getRegistrations: jest.fn().mockResolvedValue([
        {
          active: { postMessage: mockPostMessage },
          unregister: mockUnregister,
        },
      ]),
      addEventListener: jest.fn((event, callback) => {
        if (event === 'message') {
          // Immediately simulate the completion message to resolve the promise
          setTimeout(() => {
            callback({ data: { type: 'EMERGENCY_RESET_COMPLETE' } });
          }, 0);
        }
      }),
      removeEventListener: jest.fn(),
    };

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
    });

    Object.defineProperty(global.window, 'location', {
      value: {
        reload: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
    Object.defineProperty(global.window, 'location', {
      value: originalWindowLocation,
      writable: true,
    });
    jest.clearAllMocks();
  });

  it('emergencyReset should send EMERGENCY_RESET message and reload the page', async () => {
    const { result } = renderHook(() => usePWA());

    await act(async () => {
      await result.current.emergencyReset();
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'EMERGENCY_RESET' });
    expect(global.window.location.reload).toHaveBeenCalled();
  });
});
