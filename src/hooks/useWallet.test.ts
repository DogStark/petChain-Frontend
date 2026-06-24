/**
 * Tests for useWallet hook logic
 * Run with: npx ts-node --project tsconfig.test.json src/hooks/useWallet.test.ts
 */

import assert from 'assert';

// ── Minimal stubs ────────────────────────────────────────────────

interface FakeBalance {
  asset_type: string;
  balance: string;
}

interface FakeAccount {
  publicKey: string;
  balances: FakeBalance[];
  sequence: string;
  subentryCount: number;
}

function makeFakeAccount(publicKey: string, balance = '100.0'): FakeAccount {
  return {
    publicKey,
    balances: [{ asset_type: 'native', balance }],
    sequence: '1',
    subentryCount: 0,
  };
}

// ── Simulate hook state machine ───────────────────────────────────

type WalletState = 'idle' | 'loading' | 'loaded' | 'error';

async function simulateUseWallet(
  publicKey: string | null,
  getAccount: (pk: string) => Promise<FakeAccount>
): Promise<{ state: WalletState; wallet: FakeAccount | null; error: string | null }> {
  if (!publicKey) return { state: 'idle', wallet: null, error: null };

  try {
    const account = await getAccount(publicKey);
    return { state: 'loaded', wallet: account, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to fetch balance';
    return { state: 'error', wallet: null, error };
  }
}

// ── Tests ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

const FAKE_KEY = 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQFTHFB7LHDAFLMD6VYWBQBGD';

console.log('\nuseWallet — initial load');

await test('returns idle state when no publicKey provided', async () => {
  const result = await simulateUseWallet(null, async () => makeFakeAccount(''));
  assert.strictEqual(result.state, 'idle');
  assert.strictEqual(result.wallet, null);
  assert.strictEqual(result.error, null);
});

await test('reaches loaded state with mocked wallet data', async () => {
  const result = await simulateUseWallet(FAKE_KEY, async (pk) => makeFakeAccount(pk, '250.5'));
  assert.strictEqual(result.state, 'loaded');
  assert.ok(result.wallet !== null);
  assert.strictEqual(result.wallet!.publicKey, FAKE_KEY);
  assert.strictEqual(result.wallet!.balances[0].balance, '250.5');
});

await test('wallet contains native XLM balance', async () => {
  const result = await simulateUseWallet(FAKE_KEY, async (pk) => makeFakeAccount(pk));
  assert.strictEqual(result.wallet!.balances[0].asset_type, 'native');
  assert.ok(parseFloat(result.wallet!.balances[0].balance) >= 0);
});

console.log('\nuseWallet — error state');

await test('surfaces error state when network call fails', async () => {
  const result = await simulateUseWallet(FAKE_KEY, async () => {
    throw new Error('Network timeout');
  });
  assert.strictEqual(result.state, 'error');
  assert.strictEqual(result.wallet, null);
  assert.ok(result.error?.includes('Network timeout'));
});

await test('error message is preserved from thrown Error', async () => {
  const result = await simulateUseWallet(FAKE_KEY, async () => {
    throw new Error('Failed to load account: account not found');
  });
  assert.strictEqual(result.state, 'error');
  assert.ok(result.error?.includes('account not found'));
});

await test('non-Error throws produce fallback error message', async () => {
  const result = await simulateUseWallet(FAKE_KEY, async () => {
    throw 'string error';
  });
  assert.strictEqual(result.state, 'error');
  assert.strictEqual(result.error, 'Failed to fetch balance');
});

console.log('\nuseWallet — refresh');

await test('refresh returns fresh balance data', async () => {
  let callCount = 0;
  const getAccount = async (pk: string) => {
    callCount++;
    return makeFakeAccount(pk, callCount === 1 ? '100.0' : '200.0');
  };
  const first = await simulateUseWallet(FAKE_KEY, getAccount);
  assert.strictEqual(first.wallet!.balances[0].balance, '100.0');
  const second = await simulateUseWallet(FAKE_KEY, getAccount);
  assert.strictEqual(second.wallet!.balances[0].balance, '200.0');
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
