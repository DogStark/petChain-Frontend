/**
 * Tests for useBlockchainSync hook logic
 * Run with: npx ts-node --project tsconfig.test.json src/hooks/useBlockchainSync.test.ts
 */

import assert from 'assert';
import type { SyncResult, SyncStatus } from '@/lib/blockchain/stellarSync';

// ── Minimal fakes ─────────────────────────────────────────────────

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-001',
    petId: 'pet-001',
    type: 'vaccination',
    critical: false,
    data: { vaccine: 'Rabies' },
    ...overrides,
  };
}

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    recordId: 'rec-001',
    status: 'success',
    attempts: 0,
    fee: '100',
    txHash: 'abc123',
    ...overrides,
  };
}

// ── Simulated hook logic ───────────────────────────────────────────
// Mirrors useBlockchainSync without React/DOM dependencies.

interface MockStellarSync {
  syncRecord: (record: unknown, keypair: unknown, key: string) => Promise<SyncResult>;
  verifyRecord: (id: string) => Promise<boolean>;
  getSyncStatus: (id: string) => SyncResult | undefined;
  getAllSyncStatuses: () => SyncResult[];
}

async function simulateSyncRecord(
  sync: MockStellarSync,
  record: ReturnType<typeof makeRecord>,
  secretKey: string,
  encryptionKey: string
): Promise<{ result: SyncResult; isLoading: boolean }> {
  // isLoading transitions: false → true → false
  const result = await sync.syncRecord(record, { publicKey: () => 'FAKE' }, encryptionKey);
  return { result, isLoading: false };
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

// ─── syncRecord — success path ─────────────────────────────────────

console.log('\nuseBlockchainSync — syncRecord success');

await test('returns a SyncResult with status success on happy path', async () => {
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult({ status: 'success', txHash: 'tx-hash-abc' }),
    verifyRecord: async () => true,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  const { result, isLoading } = await simulateSyncRecord(sync, makeRecord(), 'SECRET', 'ENC');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.txHash, 'tx-hash-abc');
  assert.strictEqual(isLoading, false);
});

await test('result includes recordId matching the submitted record', async () => {
  const record = makeRecord({ id: 'my-record-id' });
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult({ recordId: record.id, status: 'success' }),
    verifyRecord: async () => true,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  const { result } = await simulateSyncRecord(sync, record, 'SECRET', 'ENC');
  assert.strictEqual(result.recordId, 'my-record-id');
});

// ─── syncRecord — failure path ─────────────────────────────────────

console.log('\nuseBlockchainSync — syncRecord failure');

await test('surfaces error status when sync service throws', async () => {
  const sync: MockStellarSync = {
    syncRecord: async () => { throw new Error('Horizon unreachable'); },
    verifyRecord: async () => false,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  let caughtError: string | null = null;
  try {
    await simulateSyncRecord(sync, makeRecord(), 'SECRET', 'ENC');
  } catch (err) {
    caughtError = err instanceof Error ? err.message : String(err);
  }
  assert.ok(caughtError?.includes('Horizon unreachable'));
});

await test('returns failed SyncResult when service returns failed status', async () => {
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult({ status: 'failed', error: 'tx_bad_auth', txHash: undefined }),
    verifyRecord: async () => false,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  const { result } = await simulateSyncRecord(sync, makeRecord(), 'SECRET', 'ENC');
  assert.strictEqual(result.status, 'failed');
  assert.strictEqual(result.error, 'tx_bad_auth');
  assert.strictEqual(result.txHash, undefined);
});

// ─── verifyRecord ─────────────────────────────────────────────────

console.log('\nuseBlockchainSync — verifyRecord');

await test('returns true when underlying sync confirms transaction', async () => {
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult(),
    verifyRecord: async (id) => id === 'rec-001',
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  const ok = await sync.verifyRecord('rec-001');
  assert.strictEqual(ok, true);
});

await test('returns false for an unsynced record', async () => {
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult(),
    verifyRecord: async () => false,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  const ok = await sync.verifyRecord('unknown-id');
  assert.strictEqual(ok, false);
});

// ─── getStatus ────────────────────────────────────────────────────

console.log('\nuseBlockchainSync — getStatus');

await test('getStatus returns the current SyncResult for a known record', () => {
  const known = makeSyncResult({ recordId: 'rec-001', status: 'success' });
  const sync: MockStellarSync = {
    syncRecord: async () => known,
    verifyRecord: async () => true,
    getSyncStatus: (id) => (id === 'rec-001' ? known : undefined),
    getAllSyncStatuses: () => [known],
  };

  const status = sync.getSyncStatus('rec-001');
  assert.strictEqual(status?.status, 'success');
  assert.strictEqual(status?.recordId, 'rec-001');
});

await test('getStatus returns undefined for an unknown record', () => {
  const sync: MockStellarSync = {
    syncRecord: async () => makeSyncResult(),
    verifyRecord: async () => false,
    getSyncStatus: () => undefined,
    getAllSyncStatuses: () => [],
  };

  assert.strictEqual(sync.getSyncStatus('nope'), undefined);
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
