import type { Page, Route } from '@playwright/test';

/**
 * Fixture user/tokens used across the auth e2e journey. Never real data.
 */
export const TEST_USER = {
  id: 'user_e2e_1',
  email: 'e2e.pet.owner@example.test',
  firstName: 'Ezra',
  lastName: 'Example',
  emailVerified: true,
  phoneVerified: false,
  isVerified: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const TEST_TOKENS = {
  accessToken: 'e2e-access-token',
  refreshToken: 'e2e-refresh-token',
};

type Handler = (route: Route) => Promise<void> | void;

/** Per-test map of `METHOD /auth/path` -> response handler. */
export type AuthMockMap = Record<string, Handler>;

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

/**
 * Intercepts every `/api/v1/auth/*` call the app makes and dispatches it to
 * the handler registered for `${method} ${path}` in `mocks`. Unregistered
 * routes fail loudly (500) instead of hitting the network, so a missing mock
 * is caught immediately rather than producing a flaky test.
 */
export async function installAuthApiMock(page: Page, mocks: AuthMockMap) {
  await page.route('**/api/v1/auth/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/auth/, '/auth');
    const key = `${route.request().method()} ${path}`;
    const handler = mocks[key];

    if (!handler) {
      await json(route, 500, { message: `No mock registered for ${key}` });
      return;
    }

    await handler(route);
  });
}

export const ok = (route: Route, body: unknown) => json(route, 200, body);
export const fail = (route: Route, status: number, message: string) =>
  json(route, status, { message });
