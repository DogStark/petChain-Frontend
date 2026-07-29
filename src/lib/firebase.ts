import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Returns a Firebase Messaging instance, or null when:
 * - running server-side (no `window`)
 * - the browser doesn't support the Push API
 * - required env vars are missing
 */
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  const requiredVars = [
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ];
  if (requiredVars.some((v) => !v)) {
    console.warn('Firebase: missing required env vars — push notifications disabled');
    return null;
  }

  try {
    const app = getFirebaseApp();
    return getMessaging(app);
  } catch (error) {
    console.error('Firebase messaging initialisation failed:', error);
    return null;
  }
};
