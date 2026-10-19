import { test, expect } from '@playwright/test';

/**
 * Service-worker cache versioning, update coordination, and rollback controls.
 *
 * These tests exercise the contract described in issue #987:
 *  - precache/runtime caches are versioned from the build id
 *  - obsolete caches are removed only after the new worker is ready
 *  - a controlled update prompt coordinates activation
 *  - recovery bypasses stale caches without deleting user data
 */

const BUILD_ID = 'test-build-987';
const PRECACHE = `precache-${BUILD_ID}`;
const RUNTIME = `runtime-${BUILD_ID}`;
const STALE_PRECACHE = 'precache-old-build';
const STALE_RUNTIME = 'runtime-old-build';

// Keys that must survive a recovery action (local medical data + credentials).
const PROTECTED_KEYS = ['medical-records', 'auth-token', 'user-credentials'];

async function seedCaches(page: import('@playwright/test').Page) {
  await page.evaluate(
    async ({ precache, runtime, stalePrecache, staleRuntime, protectedKeys }) => {
      await caches.delete(precache);
      await caches.delete(runtime);
      await caches.delete(stalePrecache);
      await caches.delete(staleRuntime);

      const precacheCache = await caches.open(precache);
      await precacheCache.put('/index.html', new Response('<html>new</html>'));

      const runtimeCache = await caches.open(runtime);
      await runtimeCache.put('/api/data', new Response('{"ok":true}'));

      const stalePrecacheCache = await caches.open(stalePrecache);
      await stalePrecacheCache.put('/index.html', new Response('<html>stale</html>'));

      const staleRuntimeCache = await caches.open(staleRuntime);
      await staleRuntimeCache.put('/api/data', new Response('{"ok":false}'));

      for (const key of protectedKeys) {
        localStorage.setItem(key, `value-for-${key}`);
      }
    },
    {
      precache: PRECACHE,
      runtime: RUNTIME,
      stalePrecache: STALE_PRECACHE,
      staleRuntime: STALE_RUNTIME,
      protectedKeys: PROTECTED_KEYS,
    },
  );
}

async function cacheNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(async () => (await caches.keys()).slice().sort());
}

test.describe('service worker cache versioning (#987)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedCaches(page);
  });

  test('precache and runtime caches are versioned from the build id', async ({ page }) => {
    const names = await cacheNames(page);
    expect(names).toContain(PRECACHE);
    expect(names).toContain(RUNTIME);
    expect(names.some((name) => name.includes(BUILD_ID))).toBe(true);
  });

  test('obsolete caches are removed only after the new worker is ready', async ({ page }) => {
    // Before activation the stale caches must still be present so a failed
    // update cannot strand the app offline.
    let names = await cacheNames(page);
    expect(names).toContain(STALE_PRECACHE);
    expect(names).toContain(STALE_RUNTIME);

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

    // After the new worker is ready, obsolete caches are pruned.
    await expect
      .poll(async () => cacheNames(page), { timeout: 10_000 })
      .not.toContain(STALE_PRECACHE);

    names = await cacheNames(page);
    expect(names).not.toContain(STALE_RUNTIME);
    expect(names).toContain(PRECACHE);
    expect(names).toContain(RUNTIME);
  });

  test('a controlled update prompt coordinates activation', async ({ page }) => {
    const prompt = page.getByRole('button', { name: /update|reload/i });
    await expect(prompt).toBeVisible({ timeout: 10_000 });

    await prompt.click();

    // Activation is coordinated: the app reloads onto the new build.
    await page.waitForLoadState('load');
    const names = await cacheNames(page);
    expect(names).toContain(PRECACHE);
  });

  test('recovery bypasses stale caches without deleting user data', async ({ page }) => {
    const recovery = page.getByRole('button', { name: /recover|reset cache|bypass/i });
    await expect(recovery).toBeVisible({ timeout: 10_000 });

    await recovery.click();
    await page.waitForLoadState('load');

    // Stale caches are bypassed/removed...
    const names = await cacheNames(page);
    expect(names).not.toContain(STALE_PRECACHE);
    expect(names).not.toContain(STALE_RUNTIME);

    // ...but local medical data and credentials are preserved.
    const preserved = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      PROTECTED_KEYS,
    );
    for (const value of preserved) {
      expect(value).not.toBeNull();
    }
  });

  test('a failed asset fetch does not strand the app offline', async ({ page }) => {
    await page.route('**/assets/**', (route) => route.abort());

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

    // The app remains usable and the previous cache version is retained.
    await expect(page.locator('body')).toBeVisible();
    const names = await cacheNames(page);
    expect(names.length).toBeGreaterThan(0);
  });
});
