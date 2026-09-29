// firebase-messaging-sw.js
//
// CSP-safe Firebase Cloud Messaging service worker.
//
// How runtime config is injected (deployment-time, no secrets):
//   1. The Next.js app serves /firebase-config.js via next.config.ts headers.
//      That file is generated at build time from NEXT_PUBLIC_FIREBASE_* env vars.
//   2. This worker imports that file using importScripts (same-origin only —
//      no external script-src widening required).
//   3. The file sets self.__FIREBASE_CONFIG__ with the public identifiers.
//
// Only PUBLIC Firebase identifiers belong here (API key is safe to expose —
// it identifies the project, not a secret). Server secrets (service account
// keys, admin SDK credentials) must never appear in any client-side file.

// ── Load runtime config (same-origin, CSP-safe) ───────────────────────────────
try {
  importScripts('/firebase-config.js');
} catch (e) {
  console.error('[firebase-messaging-sw] Could not load /firebase-config.js:', e);
}

const firebaseConfig = self.__FIREBASE_CONFIG__;

// ── Guard: refuse to initialise if config is missing or contains placeholders ─
const PLACEHOLDER = 'PLACEHOLDER';
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

function configIsValid(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  return requiredFields.every(
    (field) => cfg[field] && cfg[field] !== PLACEHOLDER && cfg[field].trim() !== '',
  );
}

if (!configIsValid(firebaseConfig)) {
  console.warn(
    '[firebase-messaging-sw] Firebase config is missing or contains placeholders. ' +
    'Background messaging will not be available. ' +
    'Set NEXT_PUBLIC_FIREBASE_* environment variables and rebuild.',
  );
} else {
  // ── Load Firebase SDK (same-origin copy served by Next.js, or CDN allowed by CSP) ─
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'PetChain';
    const options = {
      body: payload.notification?.body ?? '',
      icon: payload.notification?.icon ?? '/favicon.ico',
      badge: '/favicon.ico',
      data: payload.data ?? {},
      tag: payload.data?.tag ?? 'petchain-notification',
    };
    self.registration.showNotification(title, options);
  });
}
