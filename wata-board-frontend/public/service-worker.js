// PetChain Wata Board — Service Worker
// Strategies: cache-first (static), network-first (API), offline fallback

const CACHE_VERSION = "wata-v1.0.0";
const STATIC_CACHE = `wata-static-${CACHE_VERSION}`;
const API_CACHE = `wata-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `wata-images-${CACHE_VERSION}`;
const API_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ──────────────────────────────
self.addEventListener("activate", (event) => {
  const valid = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !valid.includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Message: force update ─────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // API: network-first with timed cache fallback
  if (url.pathname.startsWith("/api")) {
    event.respondWith(networkFirstWithExpiry(request));
    return;
  }

  // Images: cache-first
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // HTML navigation: network-first
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (JS, CSS, fonts): cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Strategies ────────────────────────────────────────────────
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
    return offlineFallback(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

async function networkFirstWithExpiry(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.clone().headers);
      headers.append("sw-fetched-at", Date.now().toString());
      const stamped = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, stamped);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const fetchedAt = cached.headers.get("sw-fetched-at");
      if (fetchedAt && Date.now() - Number(fetchedAt) < API_CACHE_EXPIRY_MS) {
        return cached;
      }
    }
    return offlineFallback(request);
  }
}

function offlineFallback(request) {
  if (request.destination === "document") {
    return caches.match("/offline.html");
  }
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

// ── Background Sync ───────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-sync-queue") {
    event.waitUntil(
      self.clients
        .matchAll()
        .then((clients) =>
          clients.forEach((c) =>
            c.postMessage({ type: "BACKGROUND_SYNC_COMPLETE" })
          )
        )
    );
  }
});

// ── Push Notifications ────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "PetChain",
    body: "You have a new notification",
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});