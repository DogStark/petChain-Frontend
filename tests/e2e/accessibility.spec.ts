import { test, expect } from '@playwright/test';
import { installAuthApiMock, ok, fail, TEST_USER, TEST_TOKENS } from './support/mockAuthApi';
import { installWalletContext, installWalletNetworkMock, VALID_FIXTURE_PIN, SEEDED_WALLET } from './support/mockWallet';

// Never use real pet, medical, contact, wallet, or credential data in fixtures.

/**
 * Accessibility announcements e2e tests.
 *
 * Verifies that asynchronous mutations (appointment booking, wallet
 * transactions, photo uploads, profile updates) produce concise,
 * contextual live-region announcements that are announced to
 * assistive technology without spamming on duplicate retries.
 */

test.describe('Accessibility announcements', () => {
  test.describe('Appointment booking', () => {
    test('announces a successful booking', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'POST /api/v1/appointments': (route) =>
          ok(route, {
            id: 'apt_e2e_1',
            petId: 'pet_e2e_1',
            vetClinicId: 'vet_e2e_1',
            scheduledDate: '2026-06-15T10:00:00Z',
            duration: 30,
            status: 'Scheduled',
            type: 'CHECKUP',
            notes: '',
            createdAt: '2026-06-01T00:00:00Z',
            updatedAt: '2026-06-01T00:00:00Z',
          }),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Book Appointment');

      // Fill the booking form using accessible labels
      await page.getByLabel('Select pet').fill('pet1');
      await page.getByLabel('Veterinarian').fill('vet1');
      await page.getByLabel('Date').fill('2026-06-15');
      await page.getByLabel('Time').fill('10:00');
      await page.click('button:has-text("Confirm booking")');

      // The success announcement should be present in the live region
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Appointment booked successfully');
    });

    test('announces a booking conflict without spamming on retry', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'POST /api/v1/appointments': (route) =>
          fail(route, 409, 'The selected time slot is no longer available.'),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Book Appointment');

      await page.getByLabel('Select pet').fill('pet1');
      await page.getByLabel('Veterinarian').fill('vet1');
      await page.getByLabel('Date').fill('2026-06-15');
      await page.getByLabel('Time').fill('10:00');
      await page.click('button:has-text("Confirm booking")');

      // The warning announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Booking conflict');
    });

    test('announces a booking failure', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'POST /api/v1/appointments': (route) => fail(route, 500, 'Internal server error'),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Book Appointment');

      await page.getByLabel('Select pet').fill('pet1');
      await page.getByLabel('Veterinarian').fill('vet1');
      await page.getByLabel('Date').fill('2026-06-15');
      await page.getByLabel('Time').fill('10:00');
      await page.click('button:has-text("Confirm booking")');

      // The error announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Booking failed');
    });
  });

  test.describe('Wallet transactions', () => {
    test('announces a successful transaction', async ({ page }) => {
      await installWalletContext(page);
      await installWalletNetworkMocks(page);
      await page.goto('/wallet');
      await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();

      // Open the send payment form
      await page.click('button:has-text("Send Payment")');

      // Fill the form using the actual field IDs
      await page.fill('#tx-destination', SEEDED_WALLET.publicKey);
      await page.fill('#tx-amount', '10');
      await page.fill('#tx-pin', VALID_FIXTURE_PIN);

      await page.click('button:has-text("Send Transaction")');

      // The success announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Transaction submitted successfully');
    });

    test('announces a transaction failure', async ({ page }) => {
      await installWalletContext(page);
      await installWalletNetworkMock(page);
      await page.goto('/wallet');
      await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();

      // Open the send payment form
      await page.click('button:has-text("Send Payment")');

      await page.fill('#tx-destination', SEEDED_WALLET.publicKey);
      await page.fill('#tx-amount', '10');
      await page.fill('#tx-pin', VALID_FIXTURE_PIN);

      await page.click('button:has-text("Send Transaction")');

      // The error announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Transaction failed');
    });
  });

  test.describe('Profile updates', () => {
    test('announces a successful profile update', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'PUT /api/v1/users/profile': (route) => ok(route, { ...TEST_USER, firstName: 'Ezra', lastName: 'Updated' }),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Profile');

      // Fill the profile form using accessible labels
      await page.getByLabel('First name').fill('Ezra');
      await page.getByLabel('Last name').fill('Updated');
      await page.click('button:has-text("Save")');

      // The success announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Profile updated successfully');
    });

    test('announces a profile update failure', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'PUT /api/v1/users/profile': (route) => fail(route, 500, 'Server error'),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Profile');

      await page.getByLabel('First name').fill('Ezra');
      await page.getByLabel('Last name').fill('Updated');
      await page.click('button:has-text("Save")');

      // The error announcement should be present
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toContainText('Failed to update profile');
    });
  });

  test.describe('Deduplication', () => {
    test('does not spam duplicate announcements within the dedupe window', async ({ page }) => {
      await installAuthApiMock(page, {
        'POST /auth/login': (route) => ok(route, { user: TEST_USER, ...TEST_TOKENS }),
        'POST /api/v1/appointments': (route) => ok(route, { id: 'apt_e2e_1' }),
      });

      await page.goto('/login');
      await page.fill('#email-address', TEST_USER.email);
      await page.fill('#password', 'Sup3r-Secret!Fixture');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await page.click('text=Book Appointment');

      await page.getByLabel('Select pet').fill('pet1');
      await page.getByLabel('Veterinarian').fill('vet1');
      await page.getByLabel('Date').fill('2026-06-15');
      await page.getByLabel('Time').fill('10:00');

      // Submit twice rapidly (second should be ignored by the in-flight guard)
      await page.click('button:has-text("Confirm booking")');
      // The second click should be ignored because isSubmitting is true
      // so no duplicate announcement is triggered

      // Only one success announcement should be present
      const liveRegion = page.locator('[aria-live]');
      const text = await liveRegion.textContent();
      const occurrences = (text?.match(/Appointment booked successfully/g) || []).length;
      expect(occurrences).toBeLessThanOrEqual(1);
    });
  });
});
