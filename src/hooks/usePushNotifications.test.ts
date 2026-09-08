/**
 * Tests for the coherent push-notification lifecycle.
 *
 * Covers:
 *  - Permission states: denied / default / granted
 *  - FCM token registration (not raw endpoint)
 *  - Token refresh / rotation via onTokenRefresh
 *  - Logout cleanup: unsubscribePush called when user logs out
 *  - Multi-device: stale token removed before registering new one
 *  - No-op when userId is null
 *  - Error handling paths
 */

import { renderHook, act } from '@testing-library/react';

// ─── Navigator.serviceWorker mock (set up before any import) ──────────────────
const mockGetSubscription = jest.fn<Promise<PushSubscription | null>, []>();
const mockPushSubscribe = jest.fn<Promise<PushSubscription>, []>();
const mockSwUnsubscribe = jest.fn<Promise<boolean>, []>();

const fakePushSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint',
  unsubscribe: mockSwUnsubscribe,
} as unknown as PushSubscription;

const mockSwAddEventListener = jest.fn();

Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  configurable: true,
  value: {
    ready: Promise.resolve({
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockPushSubscribe,
      },
    }),
    addEventListener: mockSwAddEventListener,
  },
});

// ─── Firebase mocks ──────────────────────────────────────────────────────────
const mockGetToken = jest.fn<Promise<string | null>, [unknown, unknown]>();
const mockDeleteToken = jest.fn<Promise<boolean>, [unknown]>();

// Capture the token-refresh callback so tests can trigger it directly
let capturedTokenRefreshCallback: (() => void) | null = null;
const mockOnTokenRefreshUnsubscribe = jest.fn();
const mockOnTokenRefresh = jest.fn(((_messaging: unknown, cb: () => void) => {
  capturedTokenRefreshCallback = cb;
  return mockOnTokenRefreshUnsubscribe;
}) as (messaging: unknown, cb: () => void) => () => void);

jest.mock('firebase/messaging', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...(args as [unknown, unknown])),
  onTokenRefresh: (messaging: unknown, cb: () => void) => mockOnTokenRefresh(messaging, cb),
  deleteToken: (...args: unknown[]) => mockDeleteToken(...(args as [unknown])),
}));

const mockGetMessagingFn = jest.fn();
jest.mock('@/lib/firebase', () => ({
  getFirebaseMessaging: () => mockGetMessagingFn(),
}));

// ─── API mocks ───────────────────────────────────────────────────────────────
const mockRegisterDeviceToken = jest.fn();
const mockRemoveDeviceToken = jest.fn();

jest.mock('@/lib/api/notificationsAPI', () => ({
  notificationsAPI: {
    registerDeviceToken: (...args: unknown[]) => mockRegisterDeviceToken(...args),
    removeDeviceToken: (...args: unknown[]) => mockRemoveDeviceToken(...args),
  },
}));

// ─── Notification permission shim ────────────────────────────────────────────
let notificationPermission: NotificationPermission = 'default';
const mockRequestPermission = jest.fn<Promise<NotificationPermission>, []>();

Object.defineProperty(window, 'Notification', {
  writable: true,
  configurable: true,
  value: class MockNotification {
    static get permission(): NotificationPermission {
      return notificationPermission;
    }
    static requestPermission = mockRequestPermission;
  },
});

// ─── Subject under test ───────────────────────────────────────────────────────
import { usePushNotifications } from './usePushNotifications';

// ─── Constants ────────────────────────────────────────────────────────────────
const FCM_VAPID_KEY = 'fake-vapid-key';
const USER_ID = 'user-abc';
const FCM_TOKEN_1 = 'fcm-token-aaaaaa';
const FCM_TOKEN_2 = 'fcm-token-bbbbbb';
const FAKE_MESSAGING = { name: 'mockMessaging' };

// ─── Setup / teardown helpers ─────────────────────────────────────────────────
function defaultSetup() {
  notificationPermission = 'default';
  mockRequestPermission.mockResolvedValue('granted');
  mockGetMessagingFn.mockResolvedValue(FAKE_MESSAGING);
  mockGetToken.mockResolvedValue(FCM_TOKEN_1);
  mockOnTokenRefresh.mockImplementation((_messaging: unknown, cb: () => void) => {
    capturedTokenRefreshCallback = cb;
    return mockOnTokenRefreshUnsubscribe;
  });
  mockDeleteToken.mockResolvedValue(true);
  mockRegisterDeviceToken.mockResolvedValue({ id: '1', token: FCM_TOKEN_1 });
  mockRemoveDeviceToken.mockResolvedValue(undefined);
  mockGetSubscription.mockResolvedValue(null);
  mockPushSubscribe.mockResolvedValue(fakePushSub);
  mockSwUnsubscribe.mockResolvedValue(true);
  capturedTokenRefreshCallback = null;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnTokenRefreshUnsubscribe.mockReset();
  defaultSetup();
});

// ─── Permission state tests ───────────────────────────────────────────────────
describe('usePushNotifications — permission states', () => {
  it('reflects default permission initially', () => {
    notificationPermission = 'default';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    expect(result.current.permission.default).toBe(true);
    expect(result.current.permission.granted).toBe(false);
    expect(result.current.permission.denied).toBe(false);
  });

  it('reflects denied permission initially', () => {
    notificationPermission = 'denied';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    expect(result.current.permission.denied).toBe(true);
    expect(result.current.permission.granted).toBe(false);
  });

  it('reflects granted permission initially', () => {
    notificationPermission = 'granted';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    expect(result.current.permission.granted).toBe(true);
    expect(result.current.permission.denied).toBe(false);
    expect(result.current.permission.default).toBe(false);
  });

  it('does not prompt when already denied', async () => {
    notificationPermission = 'denied';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(result.current.fcmToken).toBeNull();
  });

  it('updates state to granted after approval', async () => {
    notificationPermission = 'default';
    mockRequestPermission.mockResolvedValue('granted');
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.permission.granted).toBe(true);
  });

  it('updates state to denied when user dismisses', async () => {
    notificationPermission = 'default';
    mockRequestPermission.mockResolvedValue('denied');
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.permission.denied).toBe(true);
    expect(result.current.fcmToken).toBeNull();
  });
});

// ─── FCM token (not raw endpoint) ────────────────────────────────────────────
describe('usePushNotifications — FCM token (not raw endpoint)', () => {
  beforeEach(() => {
    notificationPermission = 'default';
  });

  it('registers the FCM token with the backend, not the raw push endpoint', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith(USER_ID, {
      token: FCM_TOKEN_1,
      platform: 'web',
    });
    // Must NOT be the raw Web Push subscription endpoint
    const calls = mockRegisterDeviceToken.mock.calls;
    calls.forEach(([, dto]) => {
      expect((dto as { token: string }).token).not.toBe(fakePushSub.endpoint);
    });
  });

  it('exposes fcmToken in hook state after registration', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.fcmToken).toBe(FCM_TOKEN_1);
  });

  it('returns null fcmToken when Firebase messaging is unavailable', async () => {
    mockGetMessagingFn.mockResolvedValue(null);
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.fcmToken).toBeNull();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
  });
});

// ─── Token rotation ───────────────────────────────────────────────────────────
describe('usePushNotifications — token rotation (onTokenRefresh)', () => {
  beforeEach(() => {
    notificationPermission = 'granted';
  });

  it('wires up onTokenRefresh after initial registration', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    // mockOnTokenRefresh is the mock we set up at the top of this file.
    expect(mockOnTokenRefresh).toHaveBeenCalled();
  });

  it('re-registers the new FCM token when rotation occurs', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    mockGetToken.mockResolvedValue(FCM_TOKEN_2);

    await act(async () => {
      expect(capturedTokenRefreshCallback).not.toBeNull();
      capturedTokenRefreshCallback!();
      // Flush micro-task queue
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    expect(mockRegisterDeviceToken).toHaveBeenCalledTimes(2);
    expect(mockRegisterDeviceToken).toHaveBeenLastCalledWith(USER_ID, {
      token: FCM_TOKEN_2,
      platform: 'web',
    });
    expect(result.current.fcmToken).toBe(FCM_TOKEN_2);
  });

  it('removes the stale token before registering the refreshed one', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    mockGetToken.mockResolvedValue(FCM_TOKEN_2);

    await act(async () => {
      capturedTokenRefreshCallback!();
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    const removeOrder = mockRemoveDeviceToken.mock.invocationCallOrder;
    const registerOrder = mockRegisterDeviceToken.mock.invocationCallOrder;
    // The last remove must precede the last register
    expect(removeOrder[removeOrder.length - 1]).toBeLessThan(
      registerOrder[registerOrder.length - 1]
    );
    expect(mockRemoveDeviceToken).toHaveBeenCalledWith(USER_ID, FCM_TOKEN_1);
  });

  it('tears down the onTokenRefresh listener on unmount', async () => {
    const { result, unmount } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    unmount();

    expect(mockOnTokenRefreshUnsubscribe).toHaveBeenCalled();
  });
});

// ─── Logout cleanup ───────────────────────────────────────────────────────────
describe('usePushNotifications — logout cleanup', () => {
  beforeEach(() => {
    notificationPermission = 'granted';
  });

  it('deletes the FCM token and removes it from the API on unsubscribe', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(mockDeleteToken).toHaveBeenCalled();
    expect(mockRemoveDeviceToken).toHaveBeenCalledWith(USER_ID, FCM_TOKEN_1);
    expect(result.current.fcmToken).toBeNull();
  });

  it('clears local token state even if the API remove call fails', async () => {
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    mockRemoveDeviceToken.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(result.current.fcmToken).toBeNull();
  });
});

// ─── Boundary / multi-device ──────────────────────────────────────────────────
describe('usePushNotifications — boundary / multi-device', () => {
  it('is a no-op when userId is null', async () => {
    notificationPermission = 'default';
    const { result } = renderHook(() => usePushNotifications(null, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(result.current.fcmToken).toBeNull();
  });

  it('does not re-register the same token if it matches what is already tracked', async () => {
    notificationPermission = 'granted';
    // Firebase returns the same cached token both times
    mockGetToken.mockResolvedValue(FCM_TOKEN_1);

    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));

    await act(async () => {
      await result.current.requestPermission();
    });
    // Second call — should detect token unchanged and skip re-registration
    await act(async () => {
      await result.current.requestPermission();
    });

    // Registered at most once (idempotent path)
    expect(mockRegisterDeviceToken).toHaveBeenCalledTimes(1);
  });

  it('sets loading=true during async flow and loading=false after', async () => {
    notificationPermission = 'granted'; // skip requestPermission so getToken is the gate

    // Use a deferred promise so we can control resolution timing.
    // All state updates must happen inside act() to avoid spurious warnings.
    let resolveFn: ((v: string) => void) | null = null;
    const deferred = new Promise<string>((res) => {
      resolveFn = res;
    });
    mockGetToken.mockReturnValue(deferred);

    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));

    // Kick off requestPermission inside act so that the synchronous state
    // updates (setLoading(true), setError(null)) are flushed correctly.
    // We store the promise but do NOT await it yet — the deferred getToken
    // keeps the function suspended so we can inspect loading mid-flight.
    let callPromise: Promise<void>;
    await act(async () => {
      callPromise = result.current.requestPermission();
      // Yield to flush the synchronous setLoading(true) / setError(null)
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(true);

    // Resolve the deferred token and wait for the whole async flow to finish.
    await act(async () => {
      resolveFn!(FCM_TOKEN_1);
      await callPromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  it('exposes an error string when getToken throws', async () => {
    notificationPermission = 'default';
    mockGetToken.mockRejectedValue(new Error('Token fetch failed'));

    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(result.current.error).toMatch(/token fetch failed/i);
    expect(result.current.fcmToken).toBeNull();
  });

  /**
   * GAP TEST 1: requestPermission when already granted (not default) should
   * still proceed to register the FCM token. Previously it could skip
   * registration if the permission branch fell through.
   */
  it('registers FCM token when permission is already granted (not default)', async () => {
    notificationPermission = 'granted';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));

    await act(async () => {
      await result.current.requestPermission();
    });

    // Must NOT have asked the browser for permission again
    expect(mockRequestPermission).not.toHaveBeenCalled();
    // Must still register the token with the backend
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith(USER_ID, {
      token: FCM_TOKEN_1,
      platform: 'web',
    });
    expect(result.current.fcmToken).toBe(FCM_TOKEN_1);
  });

  /**
   * GAP TEST 2: unsubscribe when userId is null but a token exists.
   * The local token state must still be cleared, and deleteToken must be
   * called on Firebase. The removeDeviceToken API call must NOT be made
   * because there is no authenticated user to scope it to.
   */
  it('unsubscribes and clears state even when userId is null', async () => {
    notificationPermission = 'granted';
    // First register with a real userId so fcmToken is populated
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => usePushNotifications(uid, FCM_VAPID_KEY),
      { initialProps: { uid: USER_ID } }
    );
    await act(async () => {
      await result.current.requestPermission();
    });
    expect(result.current.fcmToken).toBe(FCM_TOKEN_1);

    // Simulate logout — userId becomes null
    rerender({ uid: null });

    await act(async () => {
      await result.current.unsubscribe();
    });

    // FCM token must be cleared locally
    expect(result.current.fcmToken).toBeNull();
    // Firebase deleteToken must be called
    expect(mockDeleteToken).toHaveBeenCalled();
    // Backend removeDeviceToken must NOT be called (userId is null)
    expect(mockRemoveDeviceToken).not.toHaveBeenCalled();
  });

  /**
   * GAP TEST 3: deleteToken failure must not prevent the backend cleanup call.
   * Both steps should be attempted independently; failure of the first must
   * not swallow the second.
   */
  it('still calls removeDeviceToken on the backend when deleteToken throws', async () => {
    notificationPermission = 'granted';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    mockDeleteToken.mockRejectedValue(new Error('Firebase unavailable'));

    await act(async () => {
      await result.current.unsubscribe();
    });

    // Local state cleared
    expect(result.current.fcmToken).toBeNull();
    // Backend call still made despite deleteToken failure
    expect(mockRemoveDeviceToken).toHaveBeenCalledWith(USER_ID, FCM_TOKEN_1);
  });

  /**
   * GAP TEST 4 (architectural): The service worker relays token-rotation events
   * to application windows as `{ type: 'FCM_TOKEN_REFRESH' }` postMessages.
   * The hook must listen for this SW message and rotate the token — the same
   * way it responds to the Firebase SDK's onTokenRefresh callback.
   *
   * This test characterises the gap: if the hook doesn't add a
   * window 'message' listener, the SW relay is dead code and token rotation
   * driven from the SW will silently fail.
   */
  it('rotates the token when the SW posts FCM_TOKEN_REFRESH to the window', async () => {
    notificationPermission = 'granted';
    const { result } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    // Simulate the service worker posting FCM_TOKEN_REFRESH
    mockGetToken.mockResolvedValue(FCM_TOKEN_2);

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'FCM_TOKEN_REFRESH' } }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    expect(mockRegisterDeviceToken).toHaveBeenCalledTimes(2);
    expect(mockRegisterDeviceToken).toHaveBeenLastCalledWith(USER_ID, {
      token: FCM_TOKEN_2,
      platform: 'web',
    });
    expect(result.current.fcmToken).toBe(FCM_TOKEN_2);
  });

  /**
   * GAP TEST 5: The window 'message' listener must be removed on unmount so
   * that orphaned hooks do not continue rotating tokens after the component
   * tree is torn down.
   */
  it('removes the SW message listener on unmount', async () => {
    notificationPermission = 'granted';
    const { result, unmount } = renderHook(() => usePushNotifications(USER_ID, FCM_VAPID_KEY));
    await act(async () => {
      await result.current.requestPermission();
    });

    unmount();

    // After unmount, a window FCM_TOKEN_REFRESH message must not trigger re-registration
    mockGetToken.mockResolvedValue(FCM_TOKEN_2);
    const registerCallCountBeforeMessage = mockRegisterDeviceToken.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'FCM_TOKEN_REFRESH' } }));
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    expect(mockRegisterDeviceToken.mock.calls.length).toBe(registerCallCountBeforeMessage);
  });
});
