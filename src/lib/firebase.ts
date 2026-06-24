// import { initializeApp, getApps, getApp } from 'firebase/app';
// import { getMessaging, Messaging } from 'firebase/messaging';

// Temporarily disabled due to missing Firebase dependency
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const getFirebaseMessaging = async (): Promise<any | null> => {
  console.warn('Firebase messaging is disabled due to missing dependency');
  return null;
};
