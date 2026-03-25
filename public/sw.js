// PetChain Service Worker - Offline-first with background sync
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `petchain-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `petchain-dynamic-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline';

// Critical assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/PETCHAIN.jpeg',
  '/favicon.ico',
];

// API routes that should use network-first strategy
const API_ROUTES = ['/api/'];

// Routes that should be cached for offline use
const CACHEABLE_PAGES = [
  '/pets',
  '/appointments',
  '/profile',
  '/dashboard',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip Next.js internals and HMR
  if (url.pathname.startsWith('/_next/webpack-hmr') ||
      url.pathname.startsWith('/_next/static/chunks/webpack')) {
    return;
  }

  // API routes: network-first, no cache fallback (data must be fresh)
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js static assets: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App pages: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(OFFLINE_PAGE) || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || caches.match(OFFLINE_PAGE) ||
    new Response('Offline', { status: 503 });
}

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'petchain-sync') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'BACKGROUND_SYNC_COMPLETE' });
    });
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PetChain', body: event.data.text() };
  }

  const title = data.notification?.title || data.title || 'PetChain';
  const options = {
    body: data.notification?.body || data.body || '',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Message handling ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.payload || [];
    caches.open(DYNAMIC_CACHE).then((cache) => cache.addAll(urls));
  }
});
