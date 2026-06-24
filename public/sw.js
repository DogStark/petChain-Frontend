// PetChain Service Worker — Offline-first with IndexedDB sync
const CACHE_NAME = "petchain-v2";
const STATIC_ASSETS = ["/", "/favicon.ico", "/offline"];

// ── Install: pre-cache essential assets ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Background Sync: flush offline queue when connection restores ──
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-sync-queue") {
    event.waitUntil(flushSyncQueue());
  }
});

async function flushSyncQueue() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "BACKGROUND_SYNC_TRIGGERED" });
  });
}

// ── Message handling ──
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Fetch: strategy per request type ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // Stale-while-revalidate for pet profile and medical data APIs
  if (url.pathname.startsWith("/api/v1/pets") || url.pathname.startsWith("/api/v1/medical")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Network-first for other API calls
  if (url.pathname.startsWith("/api")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-first for HTML navigation (always get fresh pages)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("", { status: 408, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    // Don't block on the network update
    fetchPromise.catch(() => {});
    return cached;
  }

  return fetchPromise;
}
