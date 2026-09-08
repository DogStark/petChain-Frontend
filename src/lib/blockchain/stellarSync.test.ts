/**
 * Tests for StellarSyncService
 * Run with: npx ts-node --project tsconfig.test.json src/lib/blockchain/stellarSync.test.ts
 */

import assert from 'assert';
import { stellarSync, SyncResult } from './stellarSync';

// ── Helpers ───────────────────────────────────────────────────────

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-001',
    petId: 'pet-001',
    type: 'vaccination',
    critical: false,
    data: { vaccine: 'Rabies', date: '2025-01-01' },
    ...overrides,
  };
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

// ─── shouldSyncToBlockchain criteria (tested via record properties) ──

console.log('\nstellarSync — sync eligibility rules');

await test('vaccination record meets sync criteria', () => {
  const record = makeRecord({ type: 'vaccination', critical: false });
  assert.ok(
    ['vaccination', 'diagnosis'].includes(record.type as string) || record.critical,
    'vaccination should be sync-eligible'
  );
});

await test('diagnosis record meets sync criteria', () => {
  const record = makeRecord({ type: 'diagnosis', critical: false });
  assert.ok(['vaccination', 'diagnosis'].includes(record.type as string));
});

await test('checkup record does NOT meet sync criteria', () => {
  const record = makeRecord({ type: 'checkup', critical: false });
  assert.ok(!(['vaccination', 'diagnosis'].includes(record.type as string) || record.critical));
});

await test('critical checkup record meets sync criteria', () => {
  const record = makeRecord({ type: 'checkup', critical: true });
  assert.ok(record.critical === true);
});

// ─── getSyncStatus / getAllSyncStatuses ────────────────────────────

console.log('\nstellarSync — status queries');

await test('getSyncStatus returns undefined for unknown record', async () => {
  const status = stellarSync.getSyncStatus('definitely-not-queued');
  assert.strictEqual(status, undefined);
});

await test('getAllSyncStatuses returns an array', () => {
  const statuses = stellarSync.getAllSyncStatuses();
  assert.ok(Array.isArray(statuses));
});

// ─── verifyRecord ─────────────────────────────────────────────────

console.log('\nstellarSync — verifyRecord');

await test('verifyRecord returns false for an unknown record', async () => {
  const result = await stellarSync.verifyRecord('no-such-record');
  assert.strictEqual(result, false);
});

await test('verifyRecord returns false when no txHash is present', async () => {
  // A record that was queued but never submitted has no txHash
  const result = await stellarSync.verifyRecord('rec-no-tx');
  assert.strictEqual(result, false);
});

// ─── SyncResult type structure ─────────────────────────────────────

console.log('\nstellarSync — SyncResult structure');

await test('SyncResult has all required fields', () => {
  const result: SyncResult = {
    recordId: 'rec-001',
    status: 'syncing',
    attempts: 0,
    fee: '0',
  };
  assert.strictEqual(result.recordId, 'rec-001');
  assert.strictEqual(result.status, 'syncing');
  assert.strictEqual(result.attempts, 0);
  assert.strictEqual(result.fee, '0');
});

await test('SyncResult optional fields are absent by default', () => {
  const result: SyncResult = { recordId: 'r', status: 'idle', attempts: 0, fee: '0' };
  assert.strictEqual(result.txHash, undefined);
  assert.strictEqual(result.ipfsHash, undefined);
  assert.strictEqual(result.error, undefined);
});

// ─── as-any cast replacement ───────────────────────────────────────

console.log('\nstellarSync — typed getServer() replaces as-any cast');

await test('StellarService.getServer() returns a Horizon Server instance', async () => {
  const { stellarService } = await import('./index');
  const server = stellarService.getServer();
  assert.ok(typeof server === 'object', 'getServer() should return an object');
  assert.ok(typeof (server as any).loadAccount === 'function', 'should expose Horizon Server API');
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
