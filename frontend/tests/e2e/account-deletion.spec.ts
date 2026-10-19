import { test, expect, Page } from '@playwright/test';

/**
 * End-to-end coverage for account deletion completion and cache purge (#996).
 *
 * Verifies that:
 *  - a confirmed deletion signs the user out and clears user-scoped caches
 *  - a pending deletion is never mistaken for completion
 *  - back navigation does not reveal protected content after deletion
 *  - failure/cancellation states preserve only explicitly allowed data
 */

const PROTECTED_PATH = '/settings/account';
const SIGNED_OUT_PATH = '/login';

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth.token', 'test-session-token');
    window.localStorage.setItem('wallet.address', '0xabc123');
    window.sessionStorage.setItem('session.user', JSON.stringify({ id: 'u1' }));
  });
}

async function readUserScopedStorage(page: Page) {
  return page.evaluate(() => ({
    token: window.localStorage.getItem('auth.token'),
    wallet: window.localStorage.getItem('wallet.address'),
    session: window.sessionStorage.getItem('session.user'),
  }));
}

test.describe('account deletion completion and cache purge', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('confirmed deletion signs the user out and clears user-scoped caches', async ({ page }) => {
    await page.route('**/api/account/deletion', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: 'confirmed' }) }),
    );

    await page.goto(PROTECTED_PATH);
    await page.getByRole('button', { name: /delete account/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page).toHaveURL(new RegExp(SIGNED_OUT_PATH));

    const storage = await readUserScopedStorage(page);
    expect(storage.token).toBeNull();
    expect(storage.wallet).toBeNull();
    expect(storage.session).toBeNull();
  });

  test('pending deletion is not mistaken for completion', async ({ page }) => {
    await page.route('**/api/account/deletion', (route) =>
      route.fulfill({ status: 202, body: JSON.stringify({ status: 'pending' }) }),
    );

    await page.goto(PROTECTED_PATH);
    await page.getByRole('button', { name: /delete account/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    // Still authenticated and shown a pending/support path, not a success state.
    await expect(page).toHaveURL(new RegExp(PROTECTED_PATH));
    await expect(page.getByText(/deletion pending/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /contact support/i })).toBeVisible();

    const storage = await readUserScopedStorage(page);
    expect(storage.token).not.toBeNull();
  });

  test('failure preserves only explicitly allowed data', async ({ page }) => {
    await page.route('**/api/account/deletion', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ status: 'failed' }) }),
    );

    await page.goto(PROTECTED_PATH);
    await page.getByRole('button', { name: /delete account/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/could not delete/i)).toBeVisible();

    const storage = await readUserScopedStorage(page);
    // Session is preserved on failure; wallet data is not retained.
    expect(storage.token).not.toBeNull();
    expect(storage.wallet).toBeNull();
  });

  test('reload after confirmed deletion does not restore protected content', async ({ page }) => {
    await page.route('**/api/account/deletion', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: 'confirmed' }) }),
    );

    await page.goto(PROTECTED_PATH);
    await page.getByRole('button', { name: /delete account/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page).toHaveURL(new RegExp(SIGNED_OUT_PATH));

    await page.reload();
    await expect(page).toHaveURL(new RegExp(SIGNED_OUT_PATH));
    await expect(page.getByText(/delete account/i)).toHaveCount(0);
  });

  test('back navigation does not reveal protected content after deletion', async ({ page }) => {
    await page.route('**/api/account/deletion', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ status: 'confirmed' }) }),
    );

    await page.goto(PROTECTED_PATH);
    await page.getByRole('button', { name: /delete account/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page).toHaveURL(new RegExp(SIGNED_OUT_PATH));

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(SIGNED_OUT_PATH));
    await expect(page.getByText(/delete account/i)).toHaveCount(0);
  });
});
