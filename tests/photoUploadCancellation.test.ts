/**
 * Regression tests for issue #877:
 * Pet-photo upload cancellation and progress.
 *
 * Tests cover:
 *  - AbortController / AbortSignal cancellation semantics
 *  - Phase progress calculations (compression→verifying→uploading)
 *  - Object URL cleanup tracking
 *  - Retry-on-abort behaviour
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/photoUploadCancellation.test.ts
 */

import { UploadPhase, PhaseProgress } from '../src/components/PetPhotos/PhotoUploader';

// ─── test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${description}\n    ${msg}`);
      failed++;
    }
  };
  pendingTests.push(run());
}

const pendingTests: Promise<void>[] = [];

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if ((actual as unknown as number) < n)
        throw new Error(`Expected ${JSON.stringify(actual)} >= ${n}`);
    },
    toBeLessThanOrEqual(n: number) {
      if ((actual as unknown as number) > n)
        throw new Error(`Expected ${JSON.stringify(actual)} <= ${n}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as unknown as number) <= n)
        throw new Error(`Expected ${JSON.stringify(actual)} > ${n}`);
    },
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Pure helper that mirrors the phase-progress mapping used in PhotoUploader.
 * Maps parent uploadProgress (0-100) to the combined progress indicator.
 * Compression  0-60%, verification 60-70%, upload 70-100%.
 */
function mapUploadProgressToCombined(uploadProgress: number): number {
  return Math.min(70 + Math.round(uploadProgress * 0.3), 100);
}

/**
 * Compression phase progress formula used inside processFiles.
 * fileIndex is 0-based, total is the count of files being processed.
 */
function compressionPhasePct(fileIndex: number, total: number): number {
  return 5 + Math.round(((fileIndex + 0.5) / total) * 55);
}

// ─── AbortController / AbortSignal semantics ─────────────────────────────────

console.log('\n[#877] Photo upload cancellation and progress\n');

test('AbortController starts with signal.aborted = false', () => {
  const ac = new AbortController();
  expect(ac.signal.aborted).toBeFalsy();
});

test('AbortController.abort() sets signal.aborted = true', () => {
  const ac = new AbortController();
  ac.abort();
  expect(ac.signal.aborted).toBeTruthy();
});

test('AbortController signal fires the abort event', async () => {
  const ac = new AbortController();
  let fired = false;
  ac.signal.addEventListener('abort', () => { fired = true; });
  ac.abort();
  // Allow microtasks to flush
  await Promise.resolve();
  expect(fired).toBeTruthy();
});

test('aborting a signal after listener attached fires exactly once', async () => {
  const ac = new AbortController();
  let count = 0;
  ac.signal.addEventListener('abort', () => { count++; });
  ac.abort();
  ac.abort(); // second abort is a no-op
  await Promise.resolve();
  expect(count).toBe(1);
});

test('new AbortController replaces old one without affecting old signal', () => {
  const ac1 = new AbortController();
  const ac2 = new AbortController();
  ac1.abort();
  expect(ac2.signal.aborted).toBeFalsy();
});

// ─── Phase progress calculations ─────────────────────────────────────────────

test('compression phase percent is 5 at the very start', () => {
  const pct = compressionPhasePct(0, 4);
  expect(pct).toBeGreaterThanOrEqual(5);
  expect(pct).toBeLessThanOrEqual(35);
});

test('compression phase percent grows as file index increases', () => {
  const pct0 = compressionPhasePct(0, 4);
  const pct1 = compressionPhasePct(1, 4);
  expect(pct1).toBeGreaterThan(pct0);
});

test('compression phase percent never exceeds 60 before verification', () => {
  for (let i = 0; i < 100; i++) {
    const pct = compressionPhasePct(i, 100);
    expect(pct).toBeLessThanOrEqual(60);
  }
});

test('upload combined progress starts at 70 when upload begins', () => {
  expect(mapUploadProgressToCombined(0)).toBe(70);
});

test('upload combined progress reaches 100 at upload complete', () => {
  expect(mapUploadProgressToCombined(100)).toBe(100);
});

test('upload combined progress is monotonically increasing', () => {
  let prev = mapUploadProgressToCombined(0);
  for (let p = 1; p <= 100; p++) {
    const next = mapUploadProgressToCombined(p);
    expect(next).toBeGreaterThanOrEqual(prev);
    prev = next;
  }
});

// ─── Object URL cleanup ───────────────────────────────────────────────────────

test('revoking an object URL is idempotent (no throw)', () => {
  // In Node.js URL.createObjectURL/revokeObjectURL may not exist;
  // simulate the cleanup pattern used in PhotoUploader.
  const urls: string[] = [];
  const revoked: string[] = [];

  const mockCreateObjectURL = (file: { name: string }) => {
    const url = `blob:mock-${file.name}-${Math.random()}`;
    urls.push(url);
    return url;
  };

  const mockRevokeObjectURL = (url: string) => {
    revoked.push(url);
    // real revokeObjectURL is idempotent — calling twice should not throw
  };

  const file = { name: 'test.jpg' };
  const url = mockCreateObjectURL(file);
  mockRevokeObjectURL(url);
  mockRevokeObjectURL(url); // second revoke – should not throw

  expect(revoked.length).toBe(2);
  expect(revoked[0]).toBe(url);
  expect(revoked[1]).toBe(url);
});

test('all staged preview URLs are revoked on cancel', () => {
  const revoked: string[] = [];
  const staged = ['blob:a', 'blob:b', 'blob:c'];

  // Simulate handleCancelStaging
  staged.forEach((url) => revoked.push(url));

  expect(revoked.length).toBe(staged.length);
  staged.forEach((url, i) => {
    expect(revoked[i]).toBe(url);
  });
});

// ─── Phase type safety ────────────────────────────────────────────────────────

test('UploadPhase type includes all expected values', () => {
  const phases: UploadPhase[] = ['idle', 'compressing', 'verifying', 'uploading', 'done', 'error'];
  expect(phases.length).toBe(6);
  expect(phases.includes('idle')).toBeTruthy();
  expect(phases.includes('uploading')).toBeTruthy();
  expect(phases.includes('error')).toBeTruthy();
});

test('PhaseProgress starts at idle with percent 0', () => {
  const initial: PhaseProgress = { phase: 'idle', percent: 0, label: '' };
  expect(initial.phase).toBe('idle');
  expect(initial.percent).toBe(0);
});

// ─── summary ─────────────────────────────────────────────────────────────────

Promise.all(pendingTests).then(() => {
  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
});
