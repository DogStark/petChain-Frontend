import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '../lib/firebase';
import { notificationsAPI } from '../lib/api/notificationsAPI';

export const usePushNotifications = (userId: string | null) => {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!userId) return null;
    if (!('Notification' in window)) {
      setError('Push notifications are not supported in this browser');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        const messaging = await getFirebaseMessaging();
        if (messaging) {
          const currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (currentToken) {
            setToken(currentToken);
            await notificationsAPI.registerDeviceToken(userId, {
              token: currentToken,
              platform: 'web',
            });
            return currentToken;
          } else {
            setError('No registration token available. Request permission to generate one.');
          }
        }
      } else {
        setError('Notification permission denied');
      }
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
      setError('Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
    return null;
  }, [userId]);

  const disablePushNotifications = useCallback(async () => {
    if (!userId || !token) return;

    setLoading(true);
    try {
      await notificationsAPI.removeDeviceToken(userId, token);
      setToken(null);
    } catch (err) {
      console.error('Failed to disable push notifications', err);
      setError('Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  // Listen for foreground messages
  useEffect(() => {
    let unsubscribe: () => void;

    const setupListener = async () => {
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received: ', payload);
          // You can show a custom toast here if needed
          if (typeof window !== 'undefined') {
             new Notification(payload.notification?.title || 'New Notification', {
               body: payload.notification?.body,
               icon: '/next.svg',
             });
          }
        });
      }
    };

    setupListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return {
    token,
    permission,
    loading,
    error,
    requestPermission,
    disablePushNotifications,
  };
};
