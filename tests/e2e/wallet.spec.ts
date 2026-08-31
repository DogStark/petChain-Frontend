import { test, expect } from '@playwright/test';
import {
  installWalletContext,
  installWalletNetworkMock,
  failAccountLookup,
  VALID_FIXTURE_PIN,
  SEEDED_WALLET,
} from './support/mockWallet';

// Never use real pet, medical, contact, wallet, or credential data in fixtures.

/** Opens the wallet page with deterministic auth/wallet/network fixtures. */
async function openWallet(page: import('@playwright/test').Page) {
  await installWalletContext(page);
  await installWalletNetworkMock(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();
}

/** Clicks one of the wallet sidebar tabs, scoped to the <aside> nav. */
async function openTab(page: import('@playwright/test').Page, label: string) {
  await page
    .locator('aside')
    .getByRole('button', { name: label, exact: true })
    .click();
}

test.describe('Stellar wallet journeys', () => {
  test.describe('Wallet setup', () => {
    test('a wallet without a backup warns the user', async ({ page }) => {
      // Seed a wallet flagged as not yet backed up.
      await page.addInitScript(
        () =>
          localStorage.setItem(
            'petchain_wallets',
            JSON.stringify([
              {
                id: 'wallet_unbacked',
                publicKey: SEEDED_WALLET.publicKey,
                encryptedSecretKey: 'fixture-encrypted-key',
                iv: 'fixture-iv',
                salt: 'fixture-salt',
                label: 'Unbacked Fixture',
                type: 'standard',
                network: 'TESTNET',
                createdAt: '2026-01-02T00:00:00.000Z',
                backupVerified: false,
              },
            ])
          )
      );
      await openWallet(page);

      await expect(page.getByText('1 without backup')).toBeVisible();
      await expect(page.getByText('Backup not yet verified')).toBeVisible();
    });

    test('rejects weak and mismatched PINs before creating a wallet', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Add Wallet');

      await page.getByText('Wallet Name').fill('Setup Fixture Wallet');
      await page.getByLabel('PIN (min 8 chars)').fill('12345678');
      await page.getByLabel('Confirm PIN').fill('12345678');
      await page.getByRole('button', { name: 'Create Wallet' }).click();

      await expect(
        page.getByText('PIN cannot be numeric-only. Please include letters or special characters.')
      ).toBeVisible();

      await page.getByLabel('PIN (min 8 chars)').fill('Good-Pass!');
      await page.getByLabel('Confirm PIN').fill('Different-Pass!');
      await page.getByRole('button', { name: 'Create Wallet' }).click();
      await expect(page.getByText('PINs do not match.')).toBeVisible();
    });

    test('rejects a malformed secret key during import', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Add Wallet');
      await page.getByRole('button', { name: 'Import Existing' }).click();

      await page.getByText('Wallet Name').fill('Imported Fixture Wallet');
      await page
        .getByPlaceholder('SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
        .fill('not-a-key');
      await page.getByLabel('PIN (min 8 chars)').fill(VALID_FIXTURE_PIN);
      await page.getByLabel('Confirm PIN').fill(VALID_FIXTURE_PIN);
      await page.getByRole('button', { name: 'Import Wallet' }).click();

      await expect(page.getByText('Invalid Stellar secret key format.')).toBeVisible();
      // The form stays usable after the failure (failure recovery).
      await expect(page.getByRole('button', { name: 'Import Wallet' })).toBeVisible();
    });
  });

  test.describe('Wallet backup', () => {
    test('recovers from an incorrect backup PIN without losing state', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Backup');
      await expect(page.getByText('Export Encrypted Backup')).toBeVisible();

      await page.getByLabel('Enter your PIN to unlock backup').fill('Wrong-Pass!');
      await page.getByRole('button', { name: 'Export Encrypted Backup' }).click();

      await expect(page.getByText('Incorrect PIN. Please try again.')).toBeVisible();
      await expect(page.getByText('Export Encrypted Backup')).toBeVisible();
    });
  });

  test.describe('Wallet recovery', () => {
    test('surfaces a structured error for a malformed backup file', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Recovery');
      await expect(page.getByText('Wallet Recovery')).toBeVisible();

      await page.setInputFiles('input[type="file"]', {
        name: 'bad-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from('not valid json {', 'utf-8'),
      });

      await expect(page.getByText('Invalid backup file — could not parse JSON.')).toBeVisible();
    });

    test('rejects a backup missing required fields', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Recovery');

      await page.setInputFiles('input[type="file"]', {
        name: 'incomplete-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ version: 1, label: 'incomplete' }), 'utf-8'),
      });

      await expect(page.getByText('Missing required backup fields.')).toBeVisible();
    });
  });

  test.describe('Transaction signing', () => {
    test('requires a PIN to sign a transaction (client-side guard)', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Send');
      await expect(page.getByText('Send Payment')).toBeVisible();

      await page
        .getByPlaceholder('G... (56-character Stellar public key)')
        .fill(SEEDED_WALLET.publicKey);
      await page.getByPlaceholder('0.0000000').fill('10');
      await page.getByRole('button', { name: 'Send Transaction' }).click();

      await expect(page.getByText('PIN is required to sign the transaction.')).toBeVisible();
    });

    test('rejects an invalid destination and an insufficient balance', async ({ page }) => {
      await openWallet(page);
      await openTab(page, 'Send');

      await page.getByPlaceholder('G... (56-character Stellar public key)').fill('not-an-address');
      await page.getByPlaceholder('0.0000000').fill('1');
      await page.getByLabel('Wallet PIN').fill(VALID_FIXTURE_PIN);
      await page.getByRole('button', { name: 'Send Transaction' }).click();
      await expect(page.getByText('Invalid destination')).toBeVisible();

      await page
        .getByPlaceholder('G... (56-character Stellar public key)')
        .fill(SEEDED_WALLET.publicKey);
      await page.getByPlaceholder('0.0000000').fill('99999');
      await page.getByRole('button', { name: 'Send Transaction' }).click();
      await expect(page.getByText('Insufficient balance.')).toBeVisible();
    });
  });

  test.describe('Failure recovery', () => {
    test('recovers cleanly when an account lookup fails (unfunded account)', async ({ page }) => {
      await installWalletContext(page);
      await failAccountLookup(page);
      await installWalletNetworkMock(page);

      await page.goto('/wallet');
      await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();

      // The failed lookup must not crash the page; the selected wallet still renders.
      await expect(page.getByText(SEEDED_WALLET.label)).toBeVisible();
    });
  });
});
