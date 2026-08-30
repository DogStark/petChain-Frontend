import type { Page, Route } from '@playwright/test';

// This module mocks the wallet API, the Stellar Horizon server, and the Testnet
// Friendbot used by the /wallet journey. All values are deterministic
// fixtures - never real pet, medical, contact, wallet, or credential data.

export const FIXTURE_SECRET = 'SCV3DHHSPUKU4X5HZW4Q46W6Z6ZS7QNQFT5JXRF7TWGFXLGJXKZC2XEX';
export const FIXTURE_ADDRESS = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43NQNBOZVCCX';

export const FIXTURE_PIN = 'S3curePin!2026';

export const HORIZON = '**/horizon-testnet.stellar.org/**';
export const FRIENDBOT = '**/friendbot.stellar.org/**';

export const accountResponse = {
  _links: { self: { href: `https://horizon-testnet.stellar.org/accounts/${FIXTURE_ADDRESS}` } },
  id: FIXTURE_ADDRESS,
  account_id: FIXTURE_ADDRESS,
  sequence: '1821023238581559296',
  subentry_count: 0,
  last_modified_ledger: 123456,
  balances: [{ balance: '100.0000000', limit: '922337203685.4775807', asset_type: 'native' }],
  signers: [{ key: FIXTURE_ADDRESS, type: 'ed25519_public_key', weight: 1 }],
  data: {},
  thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
  flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
};

export const feeStats = {
  last_modified: '2026-01-01T00:00:00Z',
  fee_charged: { min: 100, mode: 1000, p10: 100, p20: 100, p30: 100, p40: 100, p50: 1000, p60: 1000, p70: 1000, p80: 1000, p90: 2000, p95: 3000, p99: 5000 },
  max_fee: { min: 100, mode: 2000, p10: 100, p20: 100, p30: 100, p40: 100, p50: 2000, p60: 2000, p70: 2000, p80: 2000, p90: 5000, p95: 10000, p99: 20000 },
  ledger_capacity_usage: 0.5,
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Installs request interception for the wallet API and network endpoints used
 * by the /wallet journey. `authApi` reuses the auth mock path for registering a
 * session; unregistered routes fail loudly (500) so a missing mock is obvious.
 */
export async function installWalletNetworkMocks(
  page: Page,
  handlers: {
    horizonGet?: (route: Route) => Promise<void> | void;
    horizonPost?: (route: Route) => Promise<void> | void;
    friendbot?: (route: Route) => Promise<void> | void;
  } = {},
) {
  const {
    horizonGet = (route) => json(route, 200, accountResponse),
    horizonPost = (route) =>
      json(route, 200, {
        hash: 'f1xture012345678901234567890123456789012345678901234567890123456789',
        ledger: 123457,
        successful: true,
        envelope_xdr: 'AAAAAA==',
        result_xdr: 'AAAAAA==',
      }),
    friendbot = (route) => json(route, 200, { hash: 'f1xture1234567890abcdef0123456789abcdef0123456789abcdef0123456789', successful: true }),
  } = handlers;

  await page.route(HORIZON, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await horizonPost(route);
      return;
    }
    await horizonGet(route);
  });

  await page.route(FRIENDBOT, async (route) => {
    await friendbot(route);
  });
}

export const ok = (route: Route, body: unknown) => json(route, 200, body);
export const fail = (route: Route, status: number, message: string) =>
  json(route, status, { message });
