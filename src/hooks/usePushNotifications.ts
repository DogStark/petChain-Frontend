// import { useState, useEffect, useCallback } from 'react';
// import { getToken, onMessage } from 'firebase/messaging';
// import { getFirebaseMessaging } from '../lib/firebase';
// import { notificationsAPI } from '../lib/api/notificationsAPI';

// Temporarily disabled due to missing Firebase dependency
export const usePushNotifications = (userId: string | null) => {
  // Return a minimal interface to prevent breaking existing code
  return {
    token: null,
    permission: 'default' as NotificationPermission,
    loading: false,
    error: null,
    requestPermission: async () => {
      console.warn('Push notifications are temporarily disabled due to missing Firebase dependency');
      return null;
    },
    unsubscribe: async () => {
      console.warn('Push notifications are temporarily disabled due to missing Firebase dependency');
    },
  };
};
