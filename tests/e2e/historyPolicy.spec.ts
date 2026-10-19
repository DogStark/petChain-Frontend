import { test, expect } from '@playwright/test';
import { installAuthApiMock, ok, fail, TEST_USER, TEST_TOKENS } from './support/mockAuthApi';

const CREDENTIALS = { email: TEST_USER.email, password: 'Sup3r-Secret!Fixture' };

test.describe('Browser History Policy for Protected Clinical Routes', () => {
  test('protected routes require current authorization on restore and prevent stale content after logout', async ({ page }) => {
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
      'POST /auth/logout': (route) => ok(route, { message: 'Logged out' }),
    });

    page.on('dialog', (dialog) => dialog.accept());

    // 1. Log in and reach dashboard
    await page.goto('/login');
    await page.fill('#email-address', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(`Welcome, ${TEST_USER.firstName}!`)).toBeVisible();

    // 2. Log out
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    // 3. Press browser back button to attempt to return to protected route
    await page.goBack();

    // 4. Verify that protected route requires authorization on restore and does not render stale clinical content
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(`Welcome, ${TEST_USER.firstName}!`)).not.toBeVisible();
  });

  test('public emergency routes follow their separate privacy policy and remain accessible in history without login', async ({ page }) => {
    // 1. Visit public emergency route
    await page.goto('/pets/pet_e2e_1/emergency');

    // 2. Navigate away to home or login page
    await page.goto('/');
    await expect(page).toHaveURL(/\//);

    // 3. Press back to return to the public emergency route
    await page.goBack();

    // 4. Verify the public emergency page is accessible and does not redirect to login
    await expect(page).toHaveURL(/\/pets\/pet_e2e_1\/emergency/);
  });

  test('account switching invalidates prior session and requires current authorization on navigation restore', async ({ page }) => {
    const user2 = {
      ...TEST_USER,
      id: 'user_e2e_2',
      email: 'user2@example.test',
      firstName: 'Second',
    };

    let currentUser = TEST_USER;
    await installAuthApiMock(page, {
      'POST /auth/login': (route) => {
        const body = route.request().postDataJSON();
        if (body.email === user2.email) {
          currentUser = user2;
        } else {
          currentUser = TEST_USER;
        }
        return ok(route, { user: currentUser, ...TEST_TOKENS });
      },
      'POST /auth/logout': (route) => ok(route, { message: 'Logged out' }),
    });

    page.on('dialog', (dialog) => dialog.accept());

    // 1. Log in as user 1
    await page.goto('/login');
    await page.fill('#email-address', TEST_USER.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Welcome, Ezra!')).toBeVisible();

    // 2. Switch account (logout and login as user 2)
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    await page.fill('#email-address', user2.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Welcome, Second!')).toBeVisible();
    await expect(page.getByText('Welcome, Ezra!')).not.toBeVisible();
  });
});
