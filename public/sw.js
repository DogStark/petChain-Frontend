// PetChain Service Worker
//
// Caching policy:
//   • Static assets (JS, CSS, images, fonts, offline page) → Cache-first via STATIC_CACHE
//   • API routes (/api/**) → Network-only, NEVER cached
//     Authenticated responses (health, wallet, account) must never be stored in
//     the SW cache because they can leak across sessions.
//   • HTML navigation → Network-first; falls back to cached /offline page
//   • SW_LOGOUT message → purges DYNAMIC_CACHE to clear any residual user data
//
// Offline pet data for authenticated users is served by the IndexedDB sync
// layer (src/lib/offline/syncManager.ts), not by the SW cache.

const STATIC_CACHE = 'petchain-static-v1';
const DYNAMIC_CACHE = 'petchain-dynamic-v1';
const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE];

// Only these paths are pre-cached on install. Keep this list minimal and
// restricted to truly public, unauthenticated assets.
const PRECACHE_ASSETS = ['/', '/favicon.ico', '/offline'];

// ── Authenticated API path prefixes ──────────────────────────────────────────
// Any request whose pathname starts with one of these prefixes is sent
// straight to the network and its response is NEVER written to any cache.
// This list must be kept in sync with the backend routing.
const AUTHENTICATED_API_PREFIXES = [
  '/api/v1/pets',
  '/api/v1/medical',
  '/api/v1/wallets',
  '/api/v1/transactions',
  '/api/v1/users',
  '/api/v1/auth',
  '/api/v1/notifications',
  '/api/v1/appointments',
  '/api/v1/clinics',
  '/api/v1/lab-results',
  '/api/v1/surgeries',
  '/api/v1/qrcodes',
  '/api/v1/analytics',
];

// ── Install: pre-cache essential public assets ────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches from previous SW versions ──────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Background sync: notify open tabs when connection restores ────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-sync-queue') {
    event.waitUntil(flushSyncQueue());
  }
});

async function flushSyncQueue() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
  });
}

// ── Message handling ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // SW_LOGOUT: clear all user-scoped cached data.
  // Sent by AuthContext immediately after a user signs out so that the next
  // session on this device cannot read a prior user's cached responses.
  if (event.data?.type === 'SW_LOGOUT') {
    event.waitUntil(
      caches.delete(DYNAMIC_CACHE).then(() => {
        // Notify all clients that the SW cache has been cleared.
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_CACHE_CLEARED' });
          });
        });
      })
    );
  }

  if (event.data?.type === "EMERGENCY_RESET") {
    // Clear all caches and unregister
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => {
      self.registration.unregister();
    }).then(() => {
      // Notify clients the reset is complete
      event.source.postMessage({ type: "EMERGENCY_RESET_COMPLETE" });
    });
  }
});

// ── Fetch: route requests by type ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Pass through non-GET requests and chrome-extension requests untouched.
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension:')) {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    // Malformed URL — let the browser handle it.
    return;
  }

  // 2. API requests → Network-only, NEVER cached.
  //    This covers both the explicit authenticated prefixes and any other
  //    /api/** path that may have been added to the backend later.
  if (isApiRequest(url, request)) {
    event.respondWith(networkOnly(request));
    return;
  }

  // 3. HTML navigation → Network-first with offline fallback.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts) → Cache-first.
  event.respondWith(cacheFirst(request));
});

// ── Route helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if this request targets an API endpoint that must never be
 * cached. Detection uses two independent signals for defence-in-depth:
 *   a) The pathname matches a known authenticated API prefix.
 *   b) The request carries an Authorization header (any bearer token).
 */
function isApiRequest(url, request) {
  if (AUTHENTICATED_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }
  // Catch all /api/** paths not in the explicit list above.
  if (url.pathname.startsWith('/api')) {
    return true;
  }
  // Extra guard: if the request already carries a bearer token we treat it as
  // authenticated and skip caching regardless of path.
  if (request.headers.get('Authorization')?.startsWith('Bearer ')) {
    return true;
  }
  return false;
}

// ── Caching strategies ────────────────────────────────────────────────────────

/** Network-only: fetch from network, never read or write cache. */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No network connection available.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/** Cache-first: serve from STATIC_CACHE, populate on first miss. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

/**
 * Network-first for HTML navigation.
 * Falls back to the cached /offline page when the network is unavailable,
 * rather than showing a browser error.
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return the pre-cached offline page as a last resort.
    const offlinePage = await caches.match('/offline');
    return (
      offlinePage ||
      new Response('<h1>Offline</h1><p>Please check your network connection.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      })
    );
  }
}
