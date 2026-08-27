/**
 * Password Policy Tests
 * Run with: npx ts-node src/utils/passwordPolicy.test.ts
 * OR: node --require ts-node/register src/utils/passwordPolicy.test.ts
 */

import assert from 'assert';
import {
  validatePassword,
  getPasswordStrength,
  isPasswordReused,
  savePasswordToHistory,
  clearPasswordHistory,
} from './passwordPolicy';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};
(globalThis as Record<string, unknown>).window = { localStorage: mockLocalStorage };
(globalThis as Record<string, unknown>).localStorage = mockLocalStorage;

let passed = 0;
let failed = 0;

const tests: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
      failed++;
    }
  });
}

// ── validatePassword ──────────────────────────────────────────────
console.log('\nvalidatePassword');

test('rejects password shorter than 8 chars', () => {
  const { valid, errors } = validatePassword('Ab1!');
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('8 characters')));
});

test('rejects password with no uppercase', () => {
  const { valid, errors } = validatePassword('abcdef1!');
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('uppercase')));
});

test('rejects password with no lowercase', () => {
  const { valid, errors } = validatePassword('ABCDEF1!');
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('lowercase')));
});

test('rejects password with no number', () => {
  const { valid, errors } = validatePassword('Abcdefg!');
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('number')));
});

test('rejects password with no special character', () => {
  const { valid, errors } = validatePassword('Abcdef12');
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('special')));
});

test('accepts strong password', () => {
  const { valid, errors } = validatePassword('StrongP@ss1');
  assert.strictEqual(valid, true);
  assert.strictEqual(errors.length, 0);
});

// ── getPasswordStrength ───────────────────────────────────────────
console.log('\ngetPasswordStrength');

test('very weak for short simple password', () => {
  const s = getPasswordStrength('abc');
  assert.ok(s.score <= 1);
});

test('short-but-diverse password (under 8 chars) is always Very Weak', () => {
  // "Ab1!" has uppercase, lowercase, digit, and special char but is only 4 chars —
  // it must score 0 (Very Weak) because validatePassword would reject it outright.
  const s = getPasswordStrength('Ab1!');
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.label, 'Very Weak');
});

test('7-char diverse password is still Very Weak', () => {
  // One char under the 8-char minimum — diversity must not lift the score.
  const s = getPasswordStrength('Ab1!xyz');
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.label, 'Very Weak');
});

test('strong for complex long password', () => {
  const s = getPasswordStrength('MyStr0ng!Pass#2024');
  assert.ok(s.score >= 3);
});

test('returns a label and color', () => {
  const s = getPasswordStrength('StrongP@ss1');
  assert.ok(typeof s.label === 'string');
  assert.ok(typeof s.color === 'string');
});

// ── password history (last 5) ─────────────────────────────────────
console.log('\npassword history');

test('new password is not flagged as reused', async () => {
  clearPasswordHistory();
  assert.strictEqual(await isPasswordReused('BrandNew@1'), false);
});

test('saved password is detected as reused', async () => {
  clearPasswordHistory();
  await savePasswordToHistory('Reused@Pass1');
  assert.strictEqual(await isPasswordReused('Reused@Pass1'), true);
});

test('different password is not flagged as reused', async () => {
  clearPasswordHistory();
  await savePasswordToHistory('First@Pass1');
  assert.strictEqual(await isPasswordReused('Different@Pass2'), false);
});

test('only last 5 passwords are tracked', async () => {
  clearPasswordHistory();
  const passwords = ['Pass@1111', 'Pass@2222', 'Pass@3333', 'Pass@4444', 'Pass@5555', 'Pass@6666'];
  for (const p of passwords) await savePasswordToHistory(p);
  // oldest (index 0) should be evicted
  assert.strictEqual(await isPasswordReused('Pass@1111'), false);
  // most recent should still be tracked
  assert.strictEqual(await isPasswordReused('Pass@6666'), true);
});

test('clearPasswordHistory removes all history', async () => {
  await savePasswordToHistory('ToBeCleared@1');
  clearPasswordHistory();
  assert.strictEqual(await isPasswordReused('ToBeCleared@1'), false);
});

test('history is scoped per identifier', async () => {
  clearPasswordHistory('userA');
  clearPasswordHistory('userB');
  await savePasswordToHistory('Shared@Pass1', 'userA');
  assert.strictEqual(await isPasswordReused('Shared@Pass1', 'userA'), true);
  assert.strictEqual(await isPasswordReused('Shared@Pass1', 'userB'), false);
});

// ── summary ───────────────────────────────────────────────────────
(async () => {
  for (const t of tests) await t();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
})();
