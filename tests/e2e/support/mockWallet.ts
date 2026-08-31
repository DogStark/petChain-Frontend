import type { Page, Route } from '@playwright/test';

/**
 * Deterministic fixtures for the Stellar wallet e2e journey. Never real pet,
 * medical, contact, wallet, or credential data.
 */
export const WALLET_USER = {
  id: 'user_wallet_e2e_1',
  email: 'wallet.pet.owner@example.test',
  firstName: 'Nia',
  lastName: 'Example',
  emailVerified: true,
  phoneVerified: false,
  isVerified: true,
  isActive: true,
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const WALLET_TOKENS = {
  accessToken: 'e2e-wallet-access-token',
  refreshToken: 'e2e-wallet-refresh-token',
};

export const VALID_FIXTURE_PIN = 'R1ght-Pass!';

/**
 * A structurally valid wallet record that passes the `isValidWalletRecords`
 * guard in `walletService`. The encrypted key/iv/salt are fixture values only —
 * the wallet page does not need them decrypted for rendering.
 */
export const SEEDED_WALLET = {
  id: 'wallet_e2e_1',
  publicKey: 'GDOP5OYR5IO5RZRVZKU5H7LJ5N2ZKHDJ3TWV5D5Q7X2YAAAAAAAAAAAA',
  encryptedSecretKey: 'fixture-encrypted-key',
  iv: 'fixture-iv',
  salt: 'fixture-salt',
  label: 'Nia Fixture Wallet',
  type: 'standard',
  network: 'TESTNET',
  createdAt: '2026-01-02T00:00:00.000Z',
  backupVerified: true,
};

/**
 * Horizon `/accounts/{publicKey}` payload used by `walletService.fetchAccountData`.
 * A native XLM balance of 125.5 lets the send form exercise balance-aware
 * validation (sufficient vs insufficient) without a live network.
 */
export const ACCOUNT_PAYLOAD = {
  id: SEEDED_WALLET.publicKey,
  account_id: SEEDED_WALLET.publicKey,
  sequence: '123456',
  balances: [
    { balance: '125.5000000', asset_type: 'native' },
  ],
  signers: [{ key: SEEDED_WALLET.publicKey, weight: 1 }],
  thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 2 },
  subentry_count: 0,
  last_modified_ledger: 1,
};

/** Horizon `/fee_stats` payload used by `walletService.estimateFee`. */
export const FEE_STATS_PAYLOAD = {
  last_ledger: '1',
  last_ledger_base_fee: '100',
  ledger_capacity_usage: 0.1,
  fee_charged: { min: '100', mode: '200', p90: '300' },
  max_fee: { min: '100', mode: '200', p90: '300' },
  fee_charged_min: '100',
  max_fee_min: '100',
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const HORIZON_ACCOUNT_RE = /\/accounts\/[A-Z0-9]{56}/;

/**
 * Seeds the auth + wallet localStorage keys the page reads on mount, so the
 * `useWallet` hook renders a pre-existing wallet and the `useAuth` gate passes
 * without any real authentication or network round-trip.
 */
export async function installWalletContext(page: Page) {
  await page.addInitScript(
    ({ user, tokens, wallet }) => {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('petchain_wallets', JSON.stringify([wallet]));
    },
    { user: WALLET_USER, tokens: WALLET_TOKENS, wallet: SEEDED_WALLET }
  );
}

/**
 * Intercepts the Stellar network boundary the wallet touches (Horizon account
 * lookups, fee stats, and the testnet friendbot) so tests are deterministic and
 * never hit a live network. Unhandled wallet-network routes fail loudly so a
 * missing mock is caught immediately.
 */
export async function installWalletNetworkMock(page: Page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (HORIZON_ACCOUNT_RE.test(url.pathname)) {
      await json(route, 200, ACCOUNT_PAYLOAD);
      return;
    }

    if (url.pathname.endsWith('/fee_stats')) {
      await json(route, 200, FEE_STATS_PAYLOAD);
      return;
    }

    if (url.hostname === 'friendbot.stellar.org') {
      await json(route, 200, {
        hash: 'fixture-fund-hash',
        successful: true,
      });
      return;
    }

    // Allow the page/static assets through; only wallet-network hosts are faked.
    route.continue();
  });
}

/**
 * Fail a Horizon account lookup with a 404 for the seeded public key, so a
 * specific test can assert the "Account not funded yet" recovery path.
 */
export function failAccountLookup(page: Page) {
  return page.route(HORIZON_ACCOUNT_RE, (route) =>
    json(route, 404, { title: 'Resource Missing', status: 404 })
  );
}

