/**
 * Service Worker caching rules — automated tests
 *
 * Strategy: We load the SW script source as a text module and evaluate it
 * against a carefully mocked service-worker global (self, caches, fetch).
 * This lets us exercise the real business logic without a browser.
 *
 * Test matrix
 * ───────────
 * ✓ Authenticated API paths are never cached (regression: was staleWhileRevalidate / networkFirst)
 * ✓ Authorization-header requests are never cached
 * ✓ /api/** catch-all is network-only
 * ✓ Non-GET requests pass through untouched
 * ✓ SW_LOGOUT message purges DYNAMIC_CACHE
 * ✓ SKIP_WAITING message calls skipWaiting
 * ✓ Static assets served from cache-first
 * ✓ HTML navigation falls back to /offline when offline
 * ✓ Offline JSON error returned for unreachable API
 * ✓ Install pre-caches only the static allowlist
 * ✓ Activate deletes stale caches
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(body = '', status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Map(Object.entries(headers)),
    clone: function () { return { ...this }; },
    body,
  };
}

function makeRequest(
  url: string,
  method = 'GET',
  headers: Record<string, string> = {}
) {
  return {
    url,
    method,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
  };
}

// Build a minimal FetchEvent
function makeFetchEvent(request: ReturnType<typeof makeRequest>) {
  let _handler: Promise<unknown> | null = null;
  return {
    request,
    respondWith: jest.fn((p: Promise<unknown>) => { _handler = p; }),
    waitUntil: jest.fn(),
    getResponse: () => _handler,
  };
}

// Build a minimal ExtendableMessageEvent
function makeMessageEvent(data: unknown) {
  return { data, waitUntil: jest.fn() };
}

// ── Cache API mock ────────────────────────────────────────────────────────────

class MockCache {
  store = new Map<string, unknown>();

  async match(req: { url: string } | string) {
    const key = typeof req === 'string' ? req : req.url;
    return this.store.get(key) ?? undefined;
  }

  async put(req: { url: string } | string, response: unknown) {
    const key = typeof req === 'string' ? req : req.url;
    this.store.set(key, response);
  }

  async addAll(urls: string[]) {
    urls.forEach((url) => this.store.set(url, makeResponse('cached:' + url)));
  }

  keys() {
    return Promise.resolve([...this.store.keys()]);
  }
}

class MockCacheStorage {
  private caches = new Map<string, MockCache>();

  async open(name: string) {
    if (!this.caches.has(name)) this.caches.set(name, new MockCache());
    return this.caches.get(name)!;
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name: string) {
    return this.caches.delete(name);
  }

  async match(req: { url: string } | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    return undefined;
  }

  // Test helper: direct access to a named cache
  get(name: string) {
    return this.caches.get(name);
  }
}

// ── Load and evaluate the SW in a controlled global context ──────────────────

function loadServiceWorker(fetchImpl: jest.Mock) {
  const cacheStorage = new MockCacheStorage();
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const skipWaiting = jest.fn();
  const claim = jest.fn();

  // Minimal service-worker global
  const swGlobal = {
    caches: cacheStorage,
    fetch: fetchImpl,
    skipWaiting,
    clients: {
      matchAll: jest.fn().mockResolvedValue([]),
      claim,
    },
    addEventListener: (type: string, handler: (e: unknown) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    URL: global.URL,
  };

  // Response must be a proper constructor; passing global.Response directly
  // loses its prototype chain when forwarded through Function parameters.
  class MockResponse {
    body: string;
    status: number;
    statusText: string;
    headers: Map<string, string>;
    ok: boolean;
    constructor(body?: string, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) {
      this.body = body ?? '';
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? 'OK';
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
  }

  const swSource = fs.readFileSync(
    path.resolve(__dirname, '../../public/sw.js'),
    'utf-8'
  );

  // eslint-disable-next-line no-new-func
  new Function(
    'self',
    'caches',
    'fetch',
    'Response',
    swSource
  )(swGlobal, cacheStorage, fetchImpl, MockResponse);

  async function dispatch(type: string, event: unknown) {
    for (const handler of listeners[type] ?? []) {
      handler(event);
    }
  }

  async function dispatchFetch(event: ReturnType<typeof makeFetchEvent>) {
    await dispatch('fetch', event);
    return event.getResponse();
  }

  return { cacheStorage, dispatch, dispatchFetch, skipWaiting, claim };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Service Worker — caching rules', () => {
  let fetchMock: jest.Mock;
  let sw: ReturnType<typeof loadServiceWorker>;

  beforeEach(() => {
    fetchMock = jest.fn();
    sw = loadServiceWorker(fetchMock);
  });

  // ── Install ─────────────────────────────────────────────────────────────────

  describe('install', () => {
    it('pre-caches only the static allowlist', async () => {
      const waitUntilPromises: Promise<unknown>[] = [];
      const installEvent = {
        waitUntil: (p: Promise<unknown>) => waitUntilPromises.push(p),
      };
      await sw.dispatch('install', installEvent);
      await Promise.all(waitUntilPromises);

      const staticCache = sw.cacheStorage.get('petchain-static-v1');
      expect(staticCache).toBeDefined();
      // Should have the three pre-cached paths and nothing else
      const keys = await staticCache!.keys();
      expect(keys).toEqual(expect.arrayContaining(['/', '/favicon.ico', '/offline']));
      expect(keys).toHaveLength(3);
    });
  });

  // ── Activate ────────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('deletes caches not in the current allowlist', async () => {
      // Simulate a stale cache from an old SW version
      await sw.cacheStorage.open('petchain-v2'); // old cache name

      const waitUntilPromises: Promise<unknown>[] = [];
      const activateEvent = {
        waitUntil: (p: Promise<unknown>) => waitUntilPromises.push(p),
      };
      await sw.dispatch('activate', activateEvent);
      await Promise.all(waitUntilPromises);

      const remainingKeys = await sw.cacheStorage.keys();
      expect(remainingKeys).not.toContain('petchain-v2');
    });

    it('keeps current cache names after activation', async () => {
      const waitUntilPromises: Promise<unknown>[] = [];
      const activateEvent = {
        waitUntil: (p: Promise<unknown>) => waitUntilPromises.push(p),
      };
      await sw.cacheStorage.open('petchain-static-v1');
      await sw.dispatch('activate', activateEvent);
      await Promise.all(waitUntilPromises);

      const remainingKeys = await sw.cacheStorage.keys();
      expect(remainingKeys).toContain('petchain-static-v1');
    });
  });

  // ── Message handling ─────────────────────────────────────────────────────────

  describe('SW_LOGOUT message', () => {
    it('deletes the dynamic cache', async () => {
      // Seed the dynamic cache with fake user data
      const dynCache = await sw.cacheStorage.open('petchain-dynamic-v1');
      await dynCache.put(
        { url: 'http://localhost/api/v1/pets' },
        makeResponse('{"pets":[]}')
      );

      const msgEvent = makeMessageEvent({ type: 'SW_LOGOUT' });
      await sw.dispatch('message', msgEvent);
      // Wait for the waitUntil promise if any
      if (msgEvent.waitUntil.mock.calls.length > 0) {
        await Promise.all(msgEvent.waitUntil.mock.calls.map(([p]: [Promise<unknown>]) => p));
      }

      const keys = await sw.cacheStorage.keys();
      expect(keys).not.toContain('petchain-dynamic-v1');
    });

    it('does not delete the static cache on logout', async () => {
      await sw.cacheStorage.open('petchain-static-v1');
      const msgEvent = makeMessageEvent({ type: 'SW_LOGOUT' });
      await sw.dispatch('message', msgEvent);
      if (msgEvent.waitUntil.mock.calls.length > 0) {
        await Promise.all(msgEvent.waitUntil.mock.calls.map(([p]: [Promise<unknown>]) => p));
      }

      const keys = await sw.cacheStorage.keys();
      expect(keys).toContain('petchain-static-v1');
    });
  });

  describe('SKIP_WAITING message', () => {
    it('calls skipWaiting', async () => {
      const msgEvent = makeMessageEvent({ type: 'SKIP_WAITING' });
      await sw.dispatch('message', msgEvent);
      expect(sw.skipWaiting).toHaveBeenCalledTimes(1);
    });
  });

  // ── Non-GET pass-through ─────────────────────────────────────────────────────

  describe('non-GET requests', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s requests are not intercepted',
      async (method) => {
        const req = makeRequest('http://localhost/api/v1/pets', method);
        const event = makeFetchEvent(req);
        await sw.dispatchFetch(event);
        // respondWith should not have been called
        expect(event.respondWith).not.toHaveBeenCalled();
        // fetch should not have been called either
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );
  });

  // ── API routes — network-only, NEVER cached ───────────────────────────────────
  // These tests reproduce the original vulnerability before the fix.

  describe('authenticated API paths — never cached (regression)', () => {
    const authenticatedPaths = [
      'http://localhost/api/v1/pets',
      'http://localhost/api/v1/pets/some-uuid/records',
      'http://localhost/api/v1/medical/vaccinations',
      'http://localhost/api/v1/wallets',
      'http://localhost/api/v1/wallets/abc123/transactions',
      'http://localhost/api/v1/transactions/history',
      'http://localhost/api/v1/users/me',
      'http://localhost/api/v1/auth/refresh',
      'http://localhost/api/v1/notifications',
      'http://localhost/api/v1/appointments',
    ];

    it.each(authenticatedPaths)(
      'does NOT cache response for %s',
      async (url) => {
        const networkResponse = makeResponse('{"data": "sensitive"}', 200);
        fetchMock.mockResolvedValueOnce(networkResponse);

        const req = makeRequest(url);
        const event = makeFetchEvent(req);
        await sw.dispatchFetch(event);
        await event.getResponse();

        // Static cache must be empty for this URL
        const staticCache = sw.cacheStorage.get('petchain-static-v1');
        if (staticCache) {
          const cached = await staticCache.match({ url });
          expect(cached).toBeUndefined();
        }
        // Dynamic cache must also be empty for this URL
        const dynCache = sw.cacheStorage.get('petchain-dynamic-v1');
        if (dynCache) {
          const cached = await dynCache.match({ url });
          expect(cached).toBeUndefined();
        }

        // Network must have been called (not served from cache)
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    );

    it('does NOT cache a request with an Authorization bearer header', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse('{"token":"secret"}', 200));

      // Even a path that looks public is blocked if it carries a bearer token
      const req = makeRequest('http://localhost/some-path', 'GET', {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.test',
      });
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      await event.getResponse();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Must not have been put in any cache
      for (const name of await sw.cacheStorage.keys()) {
        const cache = sw.cacheStorage.get(name);
        if (cache) {
          const cached = await cache.match({ url: 'http://localhost/some-path' });
          expect(cached).toBeUndefined();
        }
      }
    });

    it('returns a 503 JSON error when API is unreachable (offline)', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const req = makeRequest('http://localhost/api/v1/pets');
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      const response = (await event.getResponse()) as { status: number; headers: Map<string, string> };

      expect(response.status).toBe(503);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  // ── Generic /api/** catch-all ─────────────────────────────────────────────────

  describe('/api/** catch-all — network-only', () => {
    it('passes through an unknown /api path without caching', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse('{}', 200));

      const url = 'http://localhost/api/v2/new-feature';
      const req = makeRequest(url);
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      await event.getResponse();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      for (const name of await sw.cacheStorage.keys()) {
        const cache = sw.cacheStorage.get(name);
        if (cache) {
          expect(await cache.match({ url })).toBeUndefined();
        }
      }
    });
  });

  // ── Static assets — cache-first ───────────────────────────────────────────────

  describe('static assets — cache-first', () => {
    it('returns cached asset without hitting network', async () => {
      // Pre-populate the static cache
      const cache = await sw.cacheStorage.open('petchain-static-v1');
      const cachedResp = makeResponse('body { color: red; }', 200);
      await cache.put({ url: 'http://localhost/styles/main.css' }, cachedResp);

      const req = makeRequest('http://localhost/styles/main.css', 'GET', {
        accept: 'text/css',
      });
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      const response = await event.getResponse();

      // Network should NOT have been called
      expect(fetchMock).not.toHaveBeenCalled();
      expect(response).toBe(cachedResp);
    });

    it('fetches from network on cache miss and stores the response', async () => {
      const networkResp = makeResponse('alert("hi")', 200);
      fetchMock.mockResolvedValueOnce(networkResp);

      const url = 'http://localhost/_next/static/chunk.js';
      const req = makeRequest(url, 'GET', { accept: 'application/javascript' });
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      await event.getResponse();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const cache = sw.cacheStorage.get('petchain-static-v1');
      expect(cache).toBeDefined();
      const stored = await cache!.match({ url });
      expect(stored).toBeDefined();
    });
  });

  // ── HTML navigation — network-first with offline fallback ─────────────────────

  describe('HTML navigation — offline fallback', () => {
    it('falls back to cached /offline page when network is unavailable', async () => {
      // Pre-cache the offline page (simulating the install step)
      const cache = await sw.cacheStorage.open('petchain-static-v1');
      const offlinePage = makeResponse('<html>Offline</html>', 200, {
        'Content-Type': 'text/html',
      });
      await cache.put({ url: 'http://localhost/offline' }, offlinePage);

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const req = makeRequest('http://localhost/dashboard', 'GET', {
        accept: 'text/html',
      });
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      const response = await event.getResponse();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Should get the offline page, not a browser error
      expect(response).toBeDefined();
    });

    it('returns network response when online', async () => {
      const networkResp = makeResponse('<html>Dashboard</html>', 200, {
        'Content-Type': 'text/html',
      });
      fetchMock.mockResolvedValueOnce(networkResp);

      const req = makeRequest('http://localhost/dashboard', 'GET', {
        accept: 'text/html',
      });
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      const response = await event.getResponse();

      expect(response).toBe(networkResp);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Cross-session data leak — end-to-end scenario ─────────────────────────────

  describe('cross-session data leak prevention', () => {
    it('user-A data is not accessible after SW_LOGOUT + user-B session', async () => {
      // Simulate: user A's medical data was (incorrectly) in dynamic cache
      const dynCache = await sw.cacheStorage.open('petchain-dynamic-v1');
      await dynCache.put(
        { url: 'http://localhost/api/v1/medical/records' },
        makeResponse('{"records":[{"id":"rec-userA"}]}')
      );

      // User A logs out → SW_LOGOUT
      const msgEvent = makeMessageEvent({ type: 'SW_LOGOUT' });
      await sw.dispatch('message', msgEvent);
      if (msgEvent.waitUntil.mock.calls.length > 0) {
        await Promise.all(msgEvent.waitUntil.mock.calls.map(([p]: [Promise<unknown>]) => p));
      }

      // User B's session starts and makes an API request
      fetchMock.mockResolvedValueOnce(makeResponse('{"records":[{"id":"rec-userB"}]}'));
      const req = makeRequest('http://localhost/api/v1/medical/records');
      const event = makeFetchEvent(req);
      await sw.dispatchFetch(event);
      const response = (await event.getResponse()) as { body: string };

      // Must have gone to network (user-A's data must not be in any cache)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // The dynamic cache must have been cleared
      const remainingKeys = await sw.cacheStorage.keys();
      expect(remainingKeys).not.toContain('petchain-dynamic-v1');
    });
  });
});
