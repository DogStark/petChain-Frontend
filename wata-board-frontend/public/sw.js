const CACHE_NAME = 'wata-board-v1';
const STATIC_CACHE = 'wata-board-static-v1';
const API_CACHE = 'wata-board-api-v1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other static assets as needed
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
  '/api/health',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE && cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests with network-first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

// Handle API requests - Network first, fallback to cache
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for API:', request.url);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback response
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Offline - No network connection available',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

// Handle static assets - Cache first, fallback to network
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for static asset:', request.url);
    
    // Return offline fallback for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/') || new Response('Offline - Content not available', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    throw error;
  }
}

// Handle navigation requests - Network first, fallback to cached index.html
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, serving cached page');
    
    // Fallback to cached index.html
    const cachedResponse = await caches.match('/');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Last resort - basic offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wata-Board - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
            .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
            .offline-message { color: #666; margin-bottom: 2rem; }
            .retry-button { 
              background: #0ea5e9; color: white; border: none; 
              padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="offline-icon">📱</div>
          <h1>You're offline</h1>
          <p class="offline-message">
            Wata-Board is not available without an internet connection. 
            Please check your connection and try again.
          </p>
          <button class="retry-button" onclick="window.location.reload()">
            Try Again
          </button>
        </body>
      </html>
    `, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html',
      }
    });
  }
}

// Check if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Handle background sync for queued actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-payments') {
    event.waitUntil(syncPendingPayments());
  }
});

// Sync pending payments when back online
async function syncPendingPayments() {
  try {
    // Get pending payments from IndexedDB
    const pendingPayments = await getPendingPayments();
    
    for (const payment of pendingPayments) {
      try {
        // Retry the payment
        const response = await fetch('/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payment.data)
        });
        
        if (response.ok) {
          // Remove from pending queue on success
          await removePendingPayment(payment.id);
          console.log('[SW] Payment synced successfully:', payment.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync payment:', payment.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// IndexedDB helpers for pending payments
async function getPendingPayments() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wata-board-pending', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['payments'], 'readonly');
      const store = transaction.objectStore('payments');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('payments', { keyPath: 'id' });
    };
  });
}

async function removePendingPayment(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wata-board-pending', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['payments'], 'readwrite');
      const store = transaction.objectStore('payments');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Handle push notifications for offline status updates
self.addEventListener('push', (event) => {
  if (event.data?.json()?.type === 'offline-status') {
    const options = {
      body: event.data.json().message,
      icon: '/offline-icon.png',
      badge: '/offline-badge.png',
      tag: 'offline-status'
    };
    
    event.waitUntil(
      self.registration.showNotification('Wata-Board Status', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  if (event.notification.tag === 'offline-status') {
    event.notification.close();
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Listen for connectivity changes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CONNECTIVITY_CHANGE') {
    console.log('[SW] Connectivity changed:', event.data.isOnline);
    
    // Notify all clients about connectivity change
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'CONNECTIVITY_STATUS',
          isOnline: event.data.isOnline
        });
      });
    });
  }
});
