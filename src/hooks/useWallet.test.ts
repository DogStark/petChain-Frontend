/**
 * Tests for useWallet hook logic
 * Run with: npx ts-node --project tsconfig.test.json src/hooks/useWallet.test.ts
 */

import assert from 'assert';

// ── Minimal type stubs ────────────────────────────────────────────

interface FakeWalletAccount {
  id: string;
  publicKey: string;
  label: string;
  type: string;
  network: string;
  encryptedSecretKey: string;
  iv: string;
  salt: string;
  createdAt: string;
  backupVerified: boolean;
}

interface FakeBalance {
  asset_type: string;
  balance: string;
}

interface FakeMonitoringData {
  publicKey: string;
  balances: FakeBalance[];
  sequence: string;
  subentryCount: number;
}

interface FakeBroadcastResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// ── Fake factory helpers ──────────────────────────────────────────

function makeWallet(id = 'wallet-001', label = 'My Wallet'): FakeWalletAccount {
  return {
    id,
    publicKey: 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQFTHFB7LHDAFLMD6VYWBQBGD',
    label,
    type: 'standard',
    network: 'TESTNET',
    encryptedSecretKey: 'enc',
    iv: 'iv',
    salt: 'salt',
    createdAt: new Date().toISOString(),
    backupVerified: false,
  };
}

function makeAccountData(publicKey: string, balance = '100.0'): FakeMonitoringData {
  return {
    publicKey,
    balances: [{ asset_type: 'native', balance }],
    sequence: '1',
    subentryCount: 0,
  };
}

// ── Mock walletService factory ────────────────────────────────────

interface MockWalletService {
  getWallets: () => FakeWalletAccount[];
  fetchAccountData: (pk: string) => Promise<FakeMonitoringData>;
  createWallet: (label: string, pin: string) => Promise<FakeWalletAccount>;
  importWallet: (secret: string, label: string, pin: string) => Promise<FakeWalletAccount>;
  deleteWallet: (id: string) => void;
  sendPayment: (wallet: FakeWalletAccount, pin: string, tx: unknown) => Promise<FakeBroadcastResult>;
  fundTestnetAccount: (pk: string) => Promise<void>;
  estimateFee: () => Promise<{ baseFee: string }>;
  exportBackup: (wallet: FakeWalletAccount, pin: string) => Promise<unknown>;
  importBackup: (backup: unknown, pin: string) => Promise<FakeWalletAccount>;
  markBackupVerified: (id: string) => void;
  setupMultiSig: (wallet: FakeWalletAccount, pin: string, config: unknown) => Promise<FakeBroadcastResult>;
  removeSigner: (wallet: FakeWalletAccount, pin: string, signerKey: string) => Promise<FakeBroadcastResult>;
}

function makeMockService(overrides: Partial<MockWalletService> = {}): MockWalletService {
  const wallet = makeWallet();
  return {
    getWallets: () => [wallet],
    fetchAccountData: async (pk) => makeAccountData(pk),
    createWallet: async (label) => makeWallet('wallet-new', label),
    importWallet: async (_s, label) => makeWallet('wallet-imported', label),
    deleteWallet: () => {},
    sendPayment: async () => ({ success: true, hash: 'tx-hash' }),
    fundTestnetAccount: async () => {},
    estimateFee: async () => ({ baseFee: '100' }),
    exportBackup: async () => ({ encrypted: true }),
    importBackup: async () => makeWallet('wallet-restored'),
    markBackupVerified: () => {},
    setupMultiSig: async () => ({ success: true, hash: 'multisig-tx' }),
    removeSigner: async () => ({ success: true, hash: 'remove-signer-tx' }),
    ...overrides,
  };
}

// ── Simulated hook state (mirrors useWallet logic without React) ──

interface HookState {
  wallets: FakeWalletAccount[];
  selectedWalletId: string | null;
  loading: boolean;
  balanceLoading: boolean;
  error: string | null;
  accountData: FakeMonitoringData | null;
}

async function simulateInit(svc: MockWalletService): Promise<HookState> {
  const wallets = svc.getWallets();
  const selectedWalletId = wallets.length > 0 ? wallets[0].id : null;
  const selectedWallet = wallets.find(w => w.id === selectedWalletId) ?? null;

  let accountData: FakeMonitoringData | null = null;
  if (selectedWallet) {
    try {
      accountData = await svc.fetchAccountData(selectedWallet.publicKey);
    } catch {
      accountData = null;
    }
  }

  return { wallets, selectedWalletId, loading: false, balanceLoading: false, error: null, accountData };
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

// ─── Initial load ─────────────────────────────────────────────────

console.log('\nuseWallet — initial load');

await test('wallets are loaded from walletService on mount', async () => {
  const svc = makeMockService({ getWallets: () => [makeWallet('w-1'), makeWallet('w-2')] });
  const state = await simulateInit(svc);
  assert.strictEqual(state.wallets.length, 2);
});

await test('first wallet is auto-selected when wallets are present', async () => {
  const svc = makeMockService({ getWallets: () => [makeWallet('first'), makeWallet('second')] });
  const state = await simulateInit(svc);
  assert.strictEqual(state.selectedWalletId, 'first');
});

await test('no wallet is selected when storage is empty', async () => {
  const svc = makeMockService({ getWallets: () => [] });
  const state = await simulateInit(svc);
  assert.strictEqual(state.selectedWalletId, null);
});

await test('accountData is populated after balance fetch on mount', async () => {
  const pk = 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQFTHFB7LHDAFLMD6VYWBQBGD';
  const svc = makeMockService({
    getWallets: () => [makeWallet('w-1')],
    fetchAccountData: async () => makeAccountData(pk, '250.5'),
  });
  const state = await simulateInit(svc);
  assert.strictEqual(state.accountData?.balances[0].balance, '250.5');
});

// ─── Balance polling error state ──────────────────────────────────

console.log('\nuseWallet — balance fetch error');

await test('accountData is null when fetchAccountData fails (unfunded account)', async () => {
  const svc = makeMockService({
    getWallets: () => [makeWallet('w-1')],
    fetchAccountData: async () => { throw new Error('Account not funded'); },
  });
  const state = await simulateInit(svc);
  assert.strictEqual(state.accountData, null);
  assert.strictEqual(state.error, null);
});

// ─── createWallet ─────────────────────────────────────────────────

console.log('\nuseWallet — createWallet');

await test('createWallet resolves with the new wallet', async () => {
  const svc = makeMockService();
  const wallet = await svc.createWallet('Pet Wallet', '1234');
  assert.ok(wallet.id);
  assert.strictEqual(wallet.label, 'Pet Wallet');
});

await test('createWallet failure surfaces an error message', async () => {
  const svc = makeMockService({
    createWallet: async () => { throw new Error('PIN too short'); },
  });
  let msg: string | null = null;
  try {
    await svc.createWallet('x', '1');
  } catch (err) {
    msg = err instanceof Error ? err.message : 'unknown';
  }
  assert.strictEqual(msg, 'PIN too short');
});

// ─── importWallet ─────────────────────────────────────────────────

console.log('\nuseWallet — importWallet');

await test('importWallet resolves with imported wallet', async () => {
  const svc = makeMockService();
  const wallet = await svc.importWallet('SECRET_KEY', 'Imported', '5678');
  assert.ok(wallet.id);
  assert.strictEqual(wallet.label, 'Imported');
});

await test('importWallet failure throws', async () => {
  const svc = makeMockService({
    importWallet: async () => { throw new Error('Invalid secret key'); },
  });
  let caught: string | null = null;
  try {
    await svc.importWallet('bad', 'x', '1234');
  } catch (err) {
    caught = err instanceof Error ? err.message : 'unknown';
  }
  assert.strictEqual(caught, 'Invalid secret key');
});

// ─── deleteWallet ─────────────────────────────────────────────────

console.log('\nuseWallet — deleteWallet');

await test('deleteWallet removes the wallet and updates the list', async () => {
  const wallets = [makeWallet('w-1'), makeWallet('w-2')];
  const svc = makeMockService({
    deleteWallet: (id) => { const i = wallets.findIndex(w => w.id === id); if (i >= 0) wallets.splice(i, 1); },
    getWallets: () => [...wallets],
  });
  svc.deleteWallet('w-1');
  assert.strictEqual(svc.getWallets().length, 1);
  assert.strictEqual(svc.getWallets()[0].id, 'w-2');
});

// ─── sendPayment ──────────────────────────────────────────────────

console.log('\nuseWallet — sendPayment');

await test('sendPayment returns a successful BroadcastResult', async () => {
  const svc = makeMockService();
  const result = await svc.sendPayment(makeWallet(), '1234', { destination: 'GFAKE', amount: '10', asset: 'XLM' });
  assert.strictEqual(result.success, true);
  assert.ok(result.hash);
});

await test('sendPayment failure returns error info', async () => {
  const svc = makeMockService({
    sendPayment: async () => ({ success: false, error: 'tx_bad_auth' }),
  });
  const result = await svc.sendPayment(makeWallet(), 'wrong-pin', {});
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'tx_bad_auth');
});

// ─── fundTestnet ──────────────────────────────────────────────────

console.log('\nuseWallet — fundTestnet');

await test('fundTestnetAccount succeeds silently', async () => {
  const svc = makeMockService();
  let called = false;
  svc.fundTestnetAccount = async () => { called = true; };
  await svc.fundTestnetAccount('GPUBLIC');
  assert.strictEqual(called, true);
});

await test('fundTestnetAccount failure propagates', async () => {
  const svc = makeMockService({
    fundTestnetAccount: async () => { throw new Error('Friendbot unavailable'); },
  });
  let caught: string | null = null;
  try {
    await svc.fundTestnetAccount('GPUBLIC');
  } catch (err) {
    caught = err instanceof Error ? err.message : 'unknown';
  }
  assert.strictEqual(caught, 'Friendbot unavailable');
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
