/**
 * usePushNotifications
 *
 * Manages the full push-notification lifecycle for a single device:
 *
 *  1. Permission — request only after explicit user consent, skip when denied.
 *  2. FCM token  — obtain via Firebase Messaging (not the raw PushSubscription
 *                  endpoint) so the backend can route through FCM.
 *  3. Rotation   — two complementary paths keep the token fresh:
 *                    a. Firebase SDK `onTokenRefresh` callback (proactive)
 *                    b. Service-worker `FCM_TOKEN_REFRESH` window postMessage
 *                       (covers the SW-relay path when Firebase posts to the SW)
 *                  Both paths call `fetchAndRegisterToken` which removes the
 *                  stale token from the backend before registering the new one
 *                  (multi-device safe).
 *  4. Logout     — call `unsubscribe()` to delete the FCM token locally and
 *                  remove this device's token from the backend.
 *
 * Usage:
 *   const { permission, fcmToken, loading, error, requestPermission, unsubscribe }
 *     = usePushNotifications(userId, vapidKey);
 */

import { getToken, onTokenRefresh, deleteToken, type Messaging } from 'firebase/messaging';
import { useState, useEffect, useCallback, useRef } from 'react';

import { notificationsAPI } from '@/lib/api/notificationsAPI';
import { getFirebaseMessaging } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPermissionStatus {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

function readPermissionStatus(): PushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, denied: false, default: true };
  }
  return {
    granted: Notification.permission === 'granted',
    denied: Notification.permission === 'denied',
    default: Notification.permission === 'default',
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePushNotificationsResult {
  /** Current browser notification permission state. */
  permission: PushPermissionStatus;
  /** The active FCM registration token, or null when not registered. */
  fcmToken: string | null;
  /** True while permission is being requested or a token is being fetched. */
  loading: boolean;
  /** Last error message, or null when there is none. */
  error: string | null;
  /**
   * Request browser notification permission and, if granted, obtain an FCM
   * token and register this device with the backend.
   *
   * No-op when:
   *  - `userId` is null (unauthenticated)
   *  - permission is already denied
   *  - the current FCM token has not changed (idempotent)
   */
  requestPermission: () => Promise<void>;
  /**
   * Unsubscribe this device from push notifications.
   *
   * Deletes the FCM token from Firebase, removes it from the backend, and
   * resets local state.  Should be called on logout and before account
   * deletion.  Best-effort: local state is always cleared even when the
   * API call fails.
   */
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(
  userId: string | null,
  vapidKey: string,
): UsePushNotificationsResult {
  const [permission, setPermission] = useState<PushPermissionStatus>(readPermissionStatus);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the current FCM token so async callbacks (token
  // refresh) can read the current value without triggering re-renders.
  const fcmTokenRef = useRef<string | null>(null);
  fcmTokenRef.current = fcmToken;

  // Keep a stable ref to the messaging instance so the SW message listener
  // can call fetchAndRegisterToken without closing over a stale value.
  const messagingRef = useRef<Messaging | null>(null);

  // Keep stable refs to userId and vapidKey for use inside callbacks that
  // must not re-subscribe every time these values change.
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const vapidKeyRef = useRef<string>(vapidKey);
  vapidKeyRef.current = vapidKey;

  // Teardown function returned by `onTokenRefresh` — called on unmount.
  const unsubRefreshRef = useRef<(() => void) | null>(null);

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Fetch the current FCM token, remove the previous stale token from the
   * backend (when it has changed), and register the new one.
   *
   * Safe to call multiple times — skips the API call when the token is
   * unchanged (idempotent).
   */
  const fetchAndRegisterToken = useCallback(
    async (messaging: Messaging) => {
      const newToken = await getToken(messaging, { vapidKey: vapidKeyRef.current });
      if (!newToken) return;

      const staleToken = fcmTokenRef.current;

      if (staleToken === newToken) {
        // Token unchanged — nothing to do (idempotent).
        return;
      }

      // Remove the stale token first so multi-device cleanup is atomic.
      if (staleToken && userIdRef.current) {
        try {
          await notificationsAPI.removeDeviceToken(userIdRef.current, staleToken);
        } catch {
          // Non-fatal: the server may have already removed it (e.g., 404).
          // We still proceed with registering the new token.
        }
      }

      // Register the new token.
      if (userIdRef.current) {
        await notificationsAPI.registerDeviceToken(userIdRef.current, {
          token: newToken,
          platform: 'web',
        });
      }

      setFcmToken(newToken);
    },
    // fetchAndRegisterToken reads userId and vapidKey through refs so it
    // doesn't need to be re-created when those values change.
    [],
  );

  // ── Service-worker message relay listener ──────────────────────────────────
  //
  // The Firebase SDK posts a `firebase-messaging-sw-token-change` event to the
  // service worker when it rotates the FCM token.  Our SW relays this to every
  // controlled app window as `{ type: 'FCM_TOKEN_REFRESH' }`.  We listen here
  // so the hook handles token rotation through both channels:
  //   1. Firebase SDK `onTokenRefresh` (set up inside requestPermission)
  //   2. SW postMessage relay (set up once after mount, always active)
  //
  // The listener is attached on mount and removed on unmount; it is a no-op
  // when there is no active messaging instance (before requestPermission).

  useEffect(() => {
    function handleSwMessage(event: MessageEvent): void {
      if (!event.data || event.data.type !== 'FCM_TOKEN_REFRESH') return;
      const messaging = messagingRef.current;
      if (!messaging) return;
      // Silently refresh — errors are non-fatal; the next rotation will retry.
      fetchAndRegisterToken(messaging).catch(() => {
        /* non-fatal */
      });
    }

    window.addEventListener('message', handleSwMessage);
    return () => {
      window.removeEventListener('message', handleSwMessage);
    };
  }, [fetchAndRegisterToken]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<void> => {
    if (!userId) return;

    // Fast-path: already denied — cannot request again programmatically.
    const current = readPermissionStatus();
    if (current.denied) {
      setPermission(current);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Request browser permission when not yet decided.
      if (current.default) {
        const result = await Notification.requestPermission();
        const next: PushPermissionStatus = {
          granted: result === 'granted',
          denied: result === 'denied',
          default: result === 'default',
        };
        setPermission(next);
        if (!next.granted) return;
      } else {
        // Already granted — keep state consistent.
        setPermission(current);
      }

      // Obtain Firebase Messaging instance.
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      // Store the messaging instance so the SW message listener can use it.
      messagingRef.current = messaging;

      // Fetch (or retrieve from cache) the FCM registration token.
      await fetchAndRegisterToken(messaging);

      // Wire up token-refresh listener (replaces any prior subscription).
      if (unsubRefreshRef.current) {
        unsubRefreshRef.current();
      }
      unsubRefreshRef.current = onTokenRefresh(messaging, () => {
        // When Firebase rotates the token, silently refresh and re-register.
        fetchAndRegisterToken(messaging).catch(() => {
          /* non-fatal — next refresh attempt will retry */
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchAndRegisterToken]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    // Tear down the token-refresh listener first.
    if (unsubRefreshRef.current) {
      unsubRefreshRef.current();
      unsubRefreshRef.current = null;
    }

    const currentToken = fcmTokenRef.current;

    // Always clear local state, even when the server call fails.
    setFcmToken(null);

    // Clear the messaging ref so the SW listener becomes a no-op.
    messagingRef.current = null;

    if (!currentToken) return;

    try {
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        // Delete the token from Firebase so it is no longer deliverable.
        await deleteToken(messaging);
      }
    } catch {
      /* non-fatal — proceed to server cleanup */
    }

    if (userId) {
      try {
        await notificationsAPI.removeDeviceToken(userId, currentToken);
      } catch {
        /* non-fatal — local state is already cleared */
      }
    }
  }, [userId]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (unsubRefreshRef.current) {
        unsubRefreshRef.current();
        unsubRefreshRef.current = null;
      }
      // Clear the messaging ref so any in-flight SW messages are no-ops.
      messagingRef.current = null;
    };
  }, []);

  return { permission, fcmToken, loading, error, requestPermission, unsubscribe };
}
