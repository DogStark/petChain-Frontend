import { test, expect } from '@playwright/test';

/**
 * Issue #979: public emergency-profile robots and referrer privacy controls.
 *
 * Emergency routes must:
 *  - send noindex/noarchive robots metadata
 *  - apply a strict referrer policy consistently
 *  - prevent shared-proxy leakage via private/no-store cache headers
 *
 * Ordinary public marketing pages must NOT be affected by these controls.
 */

const EMERGENCY_ROUTE = '/emergency/demo-pet';
const MARKETING_ROUTE = '/';

const STRICT_REFERRER_POLICY = 'no-referrer';

function expectNoIndexRobots(robots: string | null) {
  expect(robots, 'robots meta must be present on emergency routes').not.toBeNull();
  const value = (robots ?? '').toLowerCase();
  expect(value).toContain('noindex');
  expect(value).toContain('noarchive');
}

function expectPrivateCache(cacheControl: string | null) {
  expect(cacheControl, 'cache-control must be present on emergency routes').not.toBeNull();
  const value = (cacheControl ?? '').toLowerCase();
  // Prevent shared-proxy leakage: must not be publicly cacheable.
  expect(value).not.toContain('public');
  expect(value.includes('no-store') || value.includes('private')).toBe(true);
}

test.describe('emergency profile privacy controls (#979)', () => {
  test('emergency route sends noindex/noarchive robots metadata', async ({ page }) => {
    await page.goto(EMERGENCY_ROUTE);

    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute('content');

    expectNoIndexRobots(robots);
  });

  test('emergency route applies a strict referrer policy', async ({ page }) => {
    await page.goto(EMERGENCY_ROUTE);

    const metaReferrer = await page
      .locator('meta[name="referrer"]')
      .first()
      .getAttribute('content');

    expect(metaReferrer).toBe(STRICT_REFERRER_POLICY);
  });

  test('emergency route response headers prevent shared-proxy leakage', async ({ request }) => {
    const response = await request.get(EMERGENCY_ROUTE);
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    expectPrivateCache(headers['cache-control'] ?? null);
    expect(headers['referrer-policy']).toBe(STRICT_REFERRER_POLICY);
    expectNoIndexRobots(headers['x-robots-tag'] ?? null);
  });

  test('ordinary marketing route is not affected by emergency privacy controls', async ({
    page,
    request,
  }) => {
    await page.goto(MARKETING_ROUTE);

    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute('content');

    // Marketing pages must not be forced into noindex/noarchive.
    const robotsValue = (robots ?? '').toLowerCase();
    expect(robotsValue).not.toContain('noindex');
    expect(robotsValue).not.toContain('noarchive');

    const response = await request.get(MARKETING_ROUTE);
    const headers = response.headers();
    const cacheControl = (headers['cache-control'] ?? '').toLowerCase();
    expect(cacheControl).not.toContain('no-store');
  });
});
