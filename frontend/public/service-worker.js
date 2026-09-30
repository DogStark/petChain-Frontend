/* Service worker with build-id cache versioning, coordinated updates, and safe recovery. */

const BUILD_ID = self.__BUILD_ID__ || 'dev';
const CACHE_PREFIX = 'app-cache';
const PRECACHE = `${CACHE_PREFIX}-precache-${BUILD_ID}`;
const RUNTIME = `${CACHE_PREFIX}-runtime-${BUILD_ID}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME];

// Assets that must be available offline. Kept minimal to avoid pinning stale bundles.
const PRECACHE_URLS = ['/', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
      // Do not skipWaiting automatically: activation is coordinated via the update prompt.
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove obsolete caches only now that this worker is activating (i.e. ready).
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'RECOVER') {
    event.waitUntil(recover());
  }
});

async function recover() {
  // Bypass stale caches without touching user data (localStorage/IndexedDB/credentials).
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))
  );
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'RECOVERED' }));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first so a fixed deployment is picked up, fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          return cached || caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  // Static assets: cache-first with runtime caching, network fallback.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(RUNTIME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // A failed asset fetch must not strand the app offline.
        return cached || Response.error();
      }
    })()
  );
});
