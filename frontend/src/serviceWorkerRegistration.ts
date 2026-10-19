// Service worker registration with cache versioning, update coordination,
// and a safe recovery path that bypasses stale caches without clearing user data.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.\d+){1,3}$/)
);

// Build id injected at build time (e.g. via DefinePlugin / NEXT_PUBLIC_BUILD_ID).
// Falls back to a timestamp so caches are still versioned in dev.
const BUILD_ID: string =
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.REACT_APP_BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID)) ||
  `dev-${Date.now()}`;

const CACHE_PREFIX = 'app-cache-';
const PRECACHE_PREFIX = 'app-precache-';
const RUNTIME_PREFIX = 'app-runtime-';
const CURRENT_CACHE_NAMES = [
  `${PRECACHE_PREFIX}${BUILD_ID}`,
  `${RUNTIME_PREFIX}${BUILD_ID}`,
];

// Keys that must never be touched by recovery. Local medical data and
// credentials live here and are preserved across every recovery action.
const PROTECTED_STORAGE_KEYS = [
  'medical-data',
  'medicalRecords',
  'auth-token',
  'credentials',
  'session',
];

export type ServiceWorkerConfig = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
  onRecovery?: () => void;
};

function isProtectedKey(key: string): boolean {
  return PROTECTED_STORAGE_KEYS.some((protectedKey) =>
    key.toLowerCase().includes(protectedKey.toLowerCase())
  );
}

// Remove obsolete caches only after the new worker is ready/activated.
async function removeObsoleteCaches(): Promise<void> {
  if (!('caches' in window)) {
    return;
  }
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => {
        const isAppCache =
          cacheName.startsWith(CACHE_PREFIX) ||
          cacheName.startsWith(PRECACHE_PREFIX) ||
          cacheName.startsWith(RUNTIME_PREFIX);
        return isAppCache && !CURRENT_CACHE_NAMES.includes(cacheName);
      })
      .map((cacheName) => caches.delete(cacheName))
  );
}

// Recovery bypasses stale caches without deleting user data. It clears only
// app-owned caches and unregisters the worker, leaving storage intact.
export async function recoverFromStaleCache(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(
          (cacheName) =>
            cacheName.startsWith(CACHE_PREFIX) ||
            cacheName.startsWith(PRECACHE_PREFIX) ||
            cacheName.startsWith(RUNTIME_PREFIX)
        )
        .map((cacheName) => caches.delete(cacheName))
    );
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
  }

  // Never clear local medical data or credentials during recovery.
  // (Intentionally no localStorage/sessionStorage clearing here.)
}

function registerValidSW(
  swUrl: string,
  config?: ServiceWorkerConfig
): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // Coordinate activation: wait for the new worker to be ready before
      // removing obsolete caches so a failed update never strands the app.
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available; prompt the user to activate.
              config && config.onUpdate && config.onUpdate(registration);
            } else {
              // Content is cached for offline use.
              config && config.onSuccess && config.onSuccess(registration);
            }
          }
        };
      };

      // Only after the new worker is ready do we drop obsolete caches.
      navigator.serviceWorker.ready.then(() => {
        removeObsoleteCaches().catch(() => {
          /* cache cleanup is best-effort */
        });
        config && config.onUpdateReady && config.onUpdateReady(registration);
      });
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(
  swUrl: string,
  config?: ServiceWorkerConfig
): void {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      // A failed asset fetch must not strand the app offline. Fall back to
      // the recovery path, which bypasses stale caches without deleting data.
      recoverFromStaleCache()
        .then(() => {
          config && config.onRecovery && config.onRecovery();
        })
        .catch(() => {
          /* recovery is best-effort; app remains usable */
        });
    });
}

export function register(config?: ServiceWorkerConfig): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `/service-worker.js?build=${encodeURIComponent(BUILD_ID)}`;

      if (isLocalhost) {
        // This is running on localhost. Check if a service worker still exists.
        checkValidServiceWorker(swUrl, config);

        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service worker.'
          );
        });
      } else {
        // Is not localhost. Just register service worker.
        registerValidSW(swUrl, config);
      }
    });
  }
}

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

export { BUILD_ID, CURRENT_CACHE_NAMES, isProtectedKey };
