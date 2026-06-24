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
  isPasswordExpired,
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

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
    failed++;
  }
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

test('new password is not flagged as reused', () => {
  clearPasswordHistory();
  assert.strictEqual(isPasswordReused('BrandNew@1'), false);
});

test('saved password is detected as reused', () => {
  clearPasswordHistory();
  savePasswordToHistory('Reused@Pass1');
  assert.strictEqual(isPasswordReused('Reused@Pass1'), true);
});

test('different password is not flagged as reused', () => {
  clearPasswordHistory();
  savePasswordToHistory('First@Pass1');
  assert.strictEqual(isPasswordReused('Different@Pass2'), false);
});

test('only last 5 passwords are tracked', () => {
  clearPasswordHistory();
  const passwords = ['Pass@1111', 'Pass@2222', 'Pass@3333', 'Pass@4444', 'Pass@5555', 'Pass@6666'];
  passwords.forEach(savePasswordToHistory);
  // oldest (index 0) should be evicted
  assert.strictEqual(isPasswordReused('Pass@1111'), false);
  // most recent should still be tracked
  assert.strictEqual(isPasswordReused('Pass@6666'), true);
});

test('clearPasswordHistory removes all history', () => {
  savePasswordToHistory('ToBeCleared@1');
  clearPasswordHistory();
  assert.strictEqual(isPasswordReused('ToBeCleared@1'), false);
});

// ── password expiry (optional) ────────────────────────────────────
console.log('\npassword expiry');

test('not expired right after saving', () => {
  clearPasswordHistory();
  savePasswordToHistory('Fresh@Pass1');
  assert.strictEqual(isPasswordExpired(), false);
});

test('expired when timestamp is old', () => {
  const ninetyOneDaysAgo = (Date.now() - 91 * 24 * 60 * 60 * 1000).toString();
  store['pw_set_at'] = ninetyOneDaysAgo;
  assert.strictEqual(isPasswordExpired(), true);
  clearPasswordHistory();
});

// ── summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
