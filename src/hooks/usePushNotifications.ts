import { useState, useEffect, useCallback } from 'react';
import { notificationService, type NotificationPermissionStatus } from '@/services/notificationService';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermissionStatus>(
    notificationService.getPermissionStatus(),
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep permission state in sync with service events
  useEffect(() => {
    return notificationService.on('permissionChange', setPermission);
  }, []);

  const requestPermission = useCallback(async (): Promise<PushSubscription | null> => {
    if (!userId) return null;
    setLoading(true);
    setError(null);
    try {
      const status = await notificationService.requestPermission();
      setPermission(status);
      if (!status.granted) return null;

      if (!VAPID_PUBLIC_KEY) {
        // No VAPID key configured — browser permission only, no push sub
        return null;
      }
      const sub = await notificationService.subscribePush(userId, VAPID_PUBLIC_KEY);
      setSubscription(sub);
      return sub;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    try {
      await notificationService.unsubscribePush(userId);
      setSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    permission,
    subscription,
    loading,
    error,
    requestPermission,
    unsubscribe,
  };
}
