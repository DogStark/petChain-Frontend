import { test, expect } from '@playwright/test';
import { installAuthApiMock, ok, fail, TEST_USER, TEST_TOKENS } from './support/mockAuthApi';

// Never use real pet, medical, contact, wallet, or credential data in fixtures.
const CREDENTIALS = { email: TEST_USER.email, password: 'Sup3r-Secret!Fixture' };

test.describe('Authentication journey', () => {
  test('logs in successfully and reaches the dashboard', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/login': (route) =>
        ok(route, { user: TEST_USER, ...TEST_TOKENS }),
    });

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(`Welcome, ${TEST_USER.firstName}!`)).toBeVisible();
  });

  test('shows an inline error for invalid credentials and stays on the login page', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => fail(route, 401, 'Invalid credentials'),
    });

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Invalid email or password. Please try again.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('steps up to 2FA, rejects an invalid code, then accepts a valid one', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => ok(route, { requires2FA: true }),
      'POST /auth/2fa/verify': async (route) => {
        const body = route.request().postDataJSON();
        if (body.token !== '123456') {
          await fail(route, 400, 'Invalid 2FA token');
          return;
        }
        await ok(route, { user: TEST_USER, ...TEST_TOKENS });
      },
    });

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Two-Factor Authentication')).toBeVisible();

    await page.fill('input[placeholder="000000"]', '000000');
    await page.click('button:has-text("Verify")');
    await expect(
      page.getByText('Invalid code. Please check your authenticator app and try again.')
    ).toBeVisible();

    await page.fill('input[placeholder="000000"]', '123456');
    await page.click('button:has-text("Verify")');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logs out and can no longer reach a protected route', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
      'POST /auth/logout': (route) => ok(route, { message: 'Logged out' }),
    });

    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects an unauthenticated visitor from a protected route to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Email verification', () => {
  test('verifies an email with a valid token', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/verify-email': (route) =>
        ok(route, {
          message: 'Verified',
          email: TEST_USER.email,
          emailVerified: true,
          phoneVerified: false,
          isVerified: true,
        }),
    });

    await page.goto('/verify-email?token=valid-fixture-token');
    await expect(page.getByText('Email Verified!')).toBeVisible();
  });

  test('shows an error for an invalid or expired verification token', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/verify-email': (route) => fail(route, 400, 'Verification token expired'),
    });

    await page.goto('/verify-email?token=expired-fixture-token');
    await expect(page.getByText('Verification token expired')).toBeVisible();
  });
});

test.describe('Password reset', () => {
  test('shows Invalid Reset Token when the link has no token', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText('Invalid Reset Token')).toBeVisible();
  });

  test('rejects mismatched passwords before calling the API', async ({ page }) => {
    await installAuthApiMock(page, {
      // Should never be hit: mismatched passwords must fail client-side.
      'POST /auth/reset-password': (route) =>
        fail(route, 500, 'reset-password must not be called for a client-side validation failure'),
    });

    await page.goto('/reset-password?token=valid-fixture-token');
    await page.fill('#password', 'Fixture-Passw0rd!');
    await page.fill('#confirmPassword', 'Different-Passw0rd!');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('resets the password with a valid token', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/reset-password': (route) => ok(route, { message: 'Password reset' }),
    });

    await page.goto('/reset-password?token=valid-fixture-token');
    await page.fill('#password', 'Fixture-Passw0rd!1');
    await page.fill('#confirmPassword', 'Fixture-Passw0rd!1');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Password Reset Successful!')).toBeVisible();
  });
});

test.describe('Session refresh and expiry', () => {
  test('silently refreshes tokens in the background and keeps the session alive', async ({ page }) => {
    await page.clock.install();

    let refreshCalls = 0;
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
      'POST /auth/refresh': (route) => {
        refreshCalls += 1;
        return ok(route, {
          user: TEST_USER,
          accessToken: 'e2e-access-token-2',
          refreshToken: 'e2e-refresh-token-2',
        });
      },
    });

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Access tokens are refreshed every 13 minutes; fast-forward past that.
    await page.clock.fastForward('14:00');
    await expect.poll(() => refreshCalls).toBeGreaterThan(0);

    // The session survives the refresh: the dashboard stays rendered.
    await expect(page.getByText(`Welcome, ${TEST_USER.firstName}!`)).toBeVisible();
  });

  test('clears the session and returns to login when the refresh token is rejected', async ({ page }) => {
    await page.clock.install();

    await installAuthApiMock(page, {
      'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
      'POST /auth/refresh': (route) => fail(route, 401, 'Refresh token expired'),
    });

    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.clock.fastForward('14:00');

    // A rejected refresh clears the stored session, so a protected route
    // bounces the now-expired session back to /login.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
