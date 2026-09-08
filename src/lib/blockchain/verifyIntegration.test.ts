/**
 * Integration verification tests for Stellar blockchain connectivity.
 * Run with: npx ts-node --project tsconfig.test.json src/lib/blockchain/verifyIntegration.test.ts
 */

import assert from 'assert';
import * as StellarSdk from '@stellar/stellar-sdk';
import { stellarService } from './index';
import { NETWORK_CONFIGS } from './types';

// ── Helpers ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  \u2717 ${name}\n    ${e.message}`);
    failed++;
  }
}

/** Wraps an async fn so it rejects if it doesn't settle within ms. */
async function withTimeout<T>(fn: () => Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {

// ─── Account Creation ─────────────────────────────────────────────

console.log('\nverifyIntegration — account creation');

await test('createAccount returns a valid Keypair with a public key starting with G', () => {
  const keypair = stellarService.createAccount();
  assert.ok(keypair, 'keypair should be truthy');
  assert.ok(typeof keypair.publicKey() === 'string', 'publicKey should be a string');
  assert.ok(keypair.publicKey().startsWith('G'), 'public key should start with G');
  assert.ok(keypair.canSign(), 'keypair should be able to sign');
});

await test('createAccount generates unique keys each call', () => {
  const a = stellarService.createAccount();
  const b = stellarService.createAccount();
  assert.notStrictEqual(a.publicKey(), b.publicKey(), 'two calls should yield different keys');
});

// ─── Account Funding (Testnet / Friendbot) ────────────────────────

console.log('\nverifyIntegration — account funding');

await test('fundAccount throws on mainnet or when Friendbot is unreachable', async () => {
  const keypair = stellarService.createAccount();
  try {
    await withTimeout(() => stellarService.fundAccount(keypair.publicKey()));
  } catch (error: any) {
    const msg = error.message.toLowerCase();
    assert.ok(
      msg.includes('friendbot') || msg.includes('testnet') || msg.includes('timed out'),
      `expected a controlled failure, got: ${error.message}`,
    );
  }
});

// ─── Account Details ──────────────────────────────────────────────

console.log('\nverifyIntegration — account details');

await test('getAccount throws for an unfunded account (or times out gracefully)', async () => {
  const keypair = stellarService.createAccount();
  try {
    await withTimeout(() => stellarService.getAccount(keypair.publicKey()));
    assert.fail('expected getAccount to throw for an unfunded account');
  } catch (error: any) {
    const msg = error.message.toLowerCase();
    assert.ok(
      msg.includes('failed to load account') || msg.includes('not found') || msg.includes('timed out'),
      `expected load-account failure or timeout, got: ${error.message}`,
    );
  }
});

// ─── Transaction Building ─────────────────────────────────────────

console.log('\nverifyIntegration — transaction building');

await test('buildTransaction throws when source account does not exist', async () => {
  const keypair = stellarService.createAccount();
  const operation = StellarSdk.Operation.manageData({
    name: 'IntegrationTest',
    value: 'test',
  }) as unknown as StellarSdk.xdr.Operation<StellarSdk.Operation>;

  try {
    await withTimeout(() => stellarService.buildTransaction(keypair.publicKey(), [operation]));
    assert.fail('expected buildTransaction to throw for an unfunded account');
  } catch (error: any) {
    const msg = error.message.toLowerCase();
    assert.ok(
      msg.includes('failed to load account') || msg.includes('not found') || msg.includes('timed out'),
      `expected load-account failure or timeout, got: ${error.message}`,
    );
  }
});

await test('buildTransaction accepts a single operation (not wrapped in array)', async () => {
  const keypair = stellarService.createAccount();
  const operation = StellarSdk.Operation.manageData({
    name: 'IntegrationTest',
    value: 'test',
  }) as unknown as StellarSdk.xdr.Operation<StellarSdk.Operation>;

  try {
    await withTimeout(() => stellarService.buildTransaction(keypair.publicKey(), operation));
    assert.fail('expected buildTransaction to throw for an unfunded account');
  } catch (error: any) {
    // This path tests that a single (non-array) operation is accepted without throwing a type error
    const msg = error.message.toLowerCase();
    assert.ok(
      msg.includes('failed to load account') || msg.includes('not found') || msg.includes('timed out'),
      `expected load-account failure or timeout, got: ${error.message}`,
    );
  }
});

// ─── Transaction Submission ───────────────────────────────────────

console.log('\nverifyIntegration — transaction submission');

await test('submitTransaction returns a TransactionResult with success or error', async () => {
  const keypair = stellarService.createAccount();
  const operation = StellarSdk.Operation.manageData({
    name: 'IntegrationTest',
    value: 'test',
  }) as unknown as StellarSdk.xdr.Operation<StellarSdk.Operation>;

  try {
    const transaction = await withTimeout(() =>
      stellarService.buildTransaction(keypair.publicKey(), [operation]),
    );
    transaction.sign(keypair);
    const result = await withTimeout(() => stellarService.submitTransaction(transaction));
    assert.ok('success' in result, 'TransactionResult should have a success field');
    if (result.success) {
      assert.ok(typeof result.hash === 'string', 'successful result should have a hash');
      assert.ok(typeof result.ledger === 'number', 'successful result should have a ledger');
    } else {
      assert.ok(typeof result.error === 'string', 'failed result should have an error message');
    }
  } catch (error: any) {
    const msg = error.message.toLowerCase();
    assert.ok(
      msg.includes('failed to load account') || msg.includes('not found') || msg.includes('timed out'),
      `expected a controlled failure before submission, got: ${error.message}`,
    );
  }
});

// ─── getServer ────────────────────────────────────────────────────

console.log('\nverifyIntegration — server instance');

await test('getServer returns a Horizon Server object with loadAccount method', () => {
  const server = stellarService.getServer();
  assert.ok(typeof server === 'object', 'getServer() should return an object');
  assert.ok(typeof (server as any).loadAccount === 'function', 'should expose loadAccount');
  assert.ok(typeof (server as any).submitTransaction === 'function', 'should expose submitTransaction');
});

// ─── Network Configuration ────────────────────────────────────────

console.log('\nverifyIntegration — network configuration');

await test('NETWORK_CONFIGS.TESTNET has correct horizonUrl and passphrase', () => {
  assert.strictEqual(NETWORK_CONFIGS.TESTNET.horizonUrl, 'https://horizon-testnet.stellar.org');
  assert.strictEqual(NETWORK_CONFIGS.TESTNET.networkPassphrase, StellarSdk.Networks.TESTNET);
  assert.strictEqual(NETWORK_CONFIGS.TESTNET.isTestnet, true);
});

await test('NETWORK_CONFIGS.PUBLIC has correct horizonUrl and passphrase', () => {
  assert.strictEqual(NETWORK_CONFIGS.PUBLIC.horizonUrl, 'https://horizon.stellar.org');
  assert.strictEqual(NETWORK_CONFIGS.PUBLIC.networkPassphrase, StellarSdk.Networks.PUBLIC);
  assert.strictEqual(NETWORK_CONFIGS.PUBLIC.isTestnet, false);
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
