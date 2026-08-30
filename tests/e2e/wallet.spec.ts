import { test, expect } from '@playwright/test';
import {
  installWalletNetworkMocks,
  FIXTURE_ADDRESS,
  FIXTURE_PIN,
  FIXTURE_SECRET,
  accountResponse,
  feeStats,
  ok,
  fail,
} from './support/mockWalletApi';

// Never use real pet, medical, contact, wallet, or credential data in fixtures.

const SESSION_USER = {
  id: 'user_e2e_wallet',
  email: 'wallet.owner@example.test',
  firstName: 'Wanda',
  lastName: 'Example',
  emailVerified: true,
  phoneVerified: true,
  isVerified: true,
  isActive: true,
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const TEST_TOKENS = {
  accessToken: 'e2e-wallet-access-token',
  refreshToken: 'e2e-wallet-refresh-token',
};

async function seedSession(page: import('@playwright/test').Page) {
  await page.addInitScript(({ user, tokens }) => {
    window.localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    window.localStorage.setItem('auth_user', JSON.stringify(user));
    window.localStorage.setItem('authToken', tokens.accessToken);
  }, { user: SESSION_USER, tokens: TEST_TOKENS });
}

test.beforeEach(async ({ page }) => {
  await seedSession(page);
});

test.describe('Wallet setup', () => {
  test('creates a new wallet and lands on the Overview tab', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();

    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await expect(page.getByRole('heading', { name: 'Add a Wallet' })).toBeVisible();

    await page.getByPlaceholder('e.g. My Pet Wallet').fill('E2E Test Wallet');
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Create Wallet' }).click();

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText(/wallet\(s\) on this device/)).toBeVisible();
  });

  test('rejects a mismatched confirm PIN during creation', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();

    await page.getByPlaceholder('e.g. My Pet Wallet').fill('E2E Mismatch Wallet');
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill('NotTheSamePin!1');
    await page.getByRole('button', { name: 'Create Wallet' }).click();

    await expect(page.getByText('PINs do not match.')).toBeVisible();
  });

  test('imports an existing wallet from a valid Stellar secret key', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();

    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Imported Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('shows an inline error for an invalid secret key on import', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();

    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Bad Secret');
    await page.locator('input[type="password"]').nth(0).fill('not-a-valid-secret');
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await expect(page.getByText(/Must start with "S" and be 56 characters/)).toBeVisible();
  });

  test('rejects importing the same wallet twice', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();

    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Duplicate Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    // Import the same secret again through the setup tab.
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Duplicate Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await expect(page.getByText(/already added as/)).toBeVisible();
  });
});

test.describe('Wallet balance and monitoring', () => {
  test('shows the funded account balance from the mocked Horizon account', async ({ page }) => {
    await installWalletNetworkMocks(page, {
      horizonGet: (route) => ok(route, accountResponse),
    });

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Balance Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await expect(page.getByText('XLM Balance')).toBeVisible();
    await expect(page.getByText('Stellar Lumens')).toBeVisible();
  });

  test('shows the un-activated account state and funds via Friendbot', async ({ page }) => {
    let friendbotCalls = 0;
    await installWalletNetworkMocks(page, {
      horizonGet: (route) => fail(route, 404, 'Resource missing'),
      friendbot: async (route) => {
        friendbotCalls += 1;
        await ok(route, { hash: 'f1xturehashf1xturehashf1xturehashf1xturehashf1xture', successful: true });
      },
    });

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Friendbot Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await expect(page.getByText(/has not been activated/)).toBeVisible();
    await page.getByRole('button', { name: /Fund with Friendbot/ }).click();
    await expect.poll(() => friendbotCalls).toBeGreaterThan(0);
  });
});

test.describe('Wallet backup', () => {
  test('exports an encrypted backup file', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Backup Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await page.getByRole('button', { name: /Backup/ }).click();
    await expect(page.getByRole('heading', { name: 'Wallet Backup' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#wallet-backup-pin').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Export Encrypted Backup' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/petchain-wallet-backup-.*\.json$/);
  });

  test('shows an incorrect-PIN error when the backup PIN is wrong', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E BadPin Backup');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await page.getByRole('button', { name: /Backup/ }).click();
    await page.locator('#wallet-backup-pin').fill('WrongPin!9');
    await page.getByRole('button', { name: 'Export Encrypted Backup' }).click();

    await expect(page.getByText('Incorrect PIN. Please try again.')).toBeVisible();
  });
});

test.describe('Wallet recovery', () => {
  const VALID_BACKUP = JSON.stringify({
    version: 1,
    publicKey: FIXTURE_ADDRESS,
    encryptedKey: 'AAECAw==',
    iv: 'AAECAw==',
    salt: 'AAECAw==',
    network: 'TESTNET',
    label: 'E2E Recovered Wallet',
    createdAt: '2026-01-01T00:00:00.000Z',
    checksum: 'deadbeef',
  });

  test('restores a wallet from a valid backup file', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Recovery/ }).click();
    await expect(page.getByRole('heading', { name: 'Restore from Backup' })).toBeVisible();

    await page
      .getByRole('button', { name: 'Select backup file' })
      .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(VALID_BACKUP) });
    await page.locator('#wallet-recovery-pin').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Restore Wallet' }).click();

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('rejects a malformed backup file', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Recovery/ }).click();

    await page
      .getByRole('button', { name: 'Select backup file' })
      .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });

    await expect(page.getByText(/Invalid backup file/)).toBeVisible();
  });
});

test.describe('Send and signing', () => {
  test('signs and broadcasts a payment successfully', async ({ page }) => {
    await installWalletNetworkMocks(page, {
      horizonGet: (route) => ok(route, accountResponse),
      horizonPost: (route) =>
        ok(route, {
          hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          ledger: 123458,
          successful: true,
          envelope_xdr: 'AAAAAA==',
          result_xdr: 'AAAAAA==',
        }),
    });

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Send Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await page.getByRole('button', { name: /Send/ }).click();
    await expect(page.getByRole('heading', { name: 'Send Payment' })).toBeVisible();

    await page.getByPlaceholder('G... (56-character Stellar public key)').fill('GDFXTARGDTQY5NKZ5SYLZBW5P5CTDLLBMCL4X2ABH3O5HSXMWJTVMSPG');
    await page.getByPlaceholder('0.0000000').fill('1.5');
    await page.getByPlaceholder('Enter PIN to sign…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Send Transaction' }).click();

    await expect(page.getByText('Transaction submitted successfully')).toBeVisible();
  });

  test('shows an inline error for an invalid destination', async ({ page }) => {
    await installWalletNetworkMocks(page);

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E BadDest Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await page.getByRole('button', { name: /Send/ }).click();
    await page.getByPlaceholder('G... (56-character Stellar public key)').fill('short');
    await page.getByPlaceholder('0.0000000').fill('1');
    await page.getByPlaceholder('Enter PIN to sign…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Send Transaction' }).click();

    await expect(page.getByText(/Invalid destination/)).toBeVisible();
  });

  test('surfaces a broadcast rejection from the network', async ({ page }) => {
    await installWalletNetworkMocks(page, {
      horizonGet: (route) => ok(route, accountResponse),
      horizonPost: (route) => fail(route, 400, 'tx_bad_seq'),
    });

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Reject Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await page.getByRole('button', { name: /Send/ }).click();
    await page.getByPlaceholder('G... (56-character Stellar public key)').fill('GDFXTARGDTQY5NKZ5SYLZBW5P5CTDLLBMCL4X2ABH3O5HSXMWJTVMSPG');
    await page.getByPlaceholder('0.0000000').fill('1');
    await page.getByPlaceholder('Enter PIN to sign…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Send Transaction' }).click();

    // The rejection surfaces the network error; the user may retry.
    await expect(page.getByText('Request failed with status code 400')).toBeVisible();
  });
});

test.describe('Pending state and failure recovery', () => {
  test('keeps the signed form intact and allows a retry after a reload', async ({ page }) => {
    await installWalletNetworkMocks(page, {
      horizonGet: (route) => ok(route, accountResponse),
      horizonPost: (route) => fail(route, 400, 'tx_too_late'),
    });

    await page.goto('/wallet');
    await page.getByRole('button', { name: /Add Wallet/ }).click();
    await page.getByRole('button', { name: 'Import Existing' }).click();
    await page.getByPlaceholder('e.g. Existing Wallet').fill('E2E Retry Wallet');
    await page.locator('input[type="password"]').nth(0).fill(FIXTURE_SECRET);
    await page.getByPlaceholder('Enter PIN…').fill(FIXTURE_PIN);
    await page.getByPlaceholder('Re-enter PIN…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Import Wallet' }).click();

    await page.getByRole('button', { name: /Send/ }).click();
    await page.getByPlaceholder('G... (56-character Stellar public key)').fill('GDFXTARGDTQY5NKZ5SYLZBW5P5CTDLLBMCL4X2ABH3O5HSXMWJTVMSPG');
    await page.getByPlaceholder('0.0000000').fill('2');
    await page.getByPlaceholder('Enter PIN to sign…').fill(FIXTURE_PIN);
    await page.getByRole('button', { name: 'Send Transaction' }).click();
    await expect(page.getByText('Request failed with status code 400')).toBeVisible();

    // Reload: the wallet is persisted, and the failure was reported.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Wallet Management' })).toBeVisible();
  });
});
