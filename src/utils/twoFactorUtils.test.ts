/**
 * Tests for twoFactorUtils — TOTP validation, backup codes, QR provisioning
 * Run with: npx ts-node --project tsconfig.test.json src/utils/twoFactorUtils.test.ts
 */

import assert from 'assert';
import { twoFactorUtils } from './twoFactorUtils';

const { validateTOTPToken, validateBackupCode, formatTOTPToken, formatBackupCode, generateQRCodeURL } = twoFactorUtils;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

// ── validateTOTPToken ─────────────────────────────────────────────

console.log('\nvalidateTOTPToken');

test('accepts a valid 6-digit code', () => {
  assert.strictEqual(validateTOTPToken('123456'), true);
});

test('accepts 000000 (all zeros are valid)', () => {
  assert.strictEqual(validateTOTPToken('000000'), true);
});

test('rejects code shorter than 6 digits', () => {
  assert.strictEqual(validateTOTPToken('12345'), false);
});

test('rejects code longer than 6 digits', () => {
  assert.strictEqual(validateTOTPToken('1234567'), false);
});

test('rejects code with letters', () => {
  assert.strictEqual(validateTOTPToken('12345a'), false);
});

test('rejects code with spaces', () => {
  assert.strictEqual(validateTOTPToken('123 45'), false);
});

test('rejects empty string', () => {
  assert.strictEqual(validateTOTPToken(''), false);
});

test('rejects special characters', () => {
  assert.strictEqual(validateTOTPToken('12345!'), false);
});

// ── validateBackupCode ────────────────────────────────────────────

console.log('\nvalidateBackupCode');

test('accepts an 8-character uppercase alphanumeric code', () => {
  assert.strictEqual(validateBackupCode('ABCD1234'), true);
});

test('accepts lowercase input (normalised to uppercase)', () => {
  assert.strictEqual(validateBackupCode('abcd1234'), true);
});

test('accepts mixed-case input', () => {
  assert.strictEqual(validateBackupCode('AbCd1234'), true);
});

test('rejects code shorter than 8 characters', () => {
  assert.strictEqual(validateBackupCode('ABC123'), false);
});

test('rejects code longer than 8 characters', () => {
  assert.strictEqual(validateBackupCode('ABCD12345'), false);
});

test('rejects code with hyphens', () => {
  assert.strictEqual(validateBackupCode('ABCD-123'), false);
});

test('rejects code with spaces', () => {
  assert.strictEqual(validateBackupCode('ABCD 123'), false);
});

// ── formatTOTPToken ───────────────────────────────────────────────

console.log('\nformatTOTPToken');

test('strips non-digit characters', () => {
  assert.strictEqual(formatTOTPToken('12 34 56'), '123456');
});

test('truncates to 6 digits', () => {
  assert.strictEqual(formatTOTPToken('1234567890'), '123456');
});

test('preserves exactly 6 digits', () => {
  assert.strictEqual(formatTOTPToken('654321'), '654321');
});

test('returns empty string for non-digit input', () => {
  assert.strictEqual(formatTOTPToken('abcdef'), '');
});

// ── formatBackupCode ──────────────────────────────────────────────

console.log('\nformatBackupCode');

test('converts to uppercase', () => {
  assert.strictEqual(formatBackupCode('abcd1234'), 'ABCD1234');
});

test('removes hyphens', () => {
  assert.strictEqual(formatBackupCode('ABCD-1234'), 'ABCD1234');
});

test('truncates to 8 characters', () => {
  assert.strictEqual(formatBackupCode('ABCD12345678'), 'ABCD1234');
});

test('strips spaces', () => {
  assert.strictEqual(formatBackupCode('ABCD 123'), 'ABCD123');
});

// ── generateQRCodeURL ─────────────────────────────────────────────

console.log('\ngenerateQRCodeURL');

test('generates an otpauth URI', () => {
  const url = generateQRCodeURL('JBSWY3DPEHPK3PXP', 'user@example.com');
  assert.ok(url.startsWith('otpauth://totp/'), `Expected otpauth URI, got: ${url}`);
});

test('URI contains the issuer', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com', 'PetChain');
  assert.ok(url.includes('PetChain'), 'URI should contain issuer');
});

test('URI contains the encoded email', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com', 'PetChain');
  assert.ok(url.includes(encodeURIComponent('user@example.com')));
});

test('URI contains the secret', () => {
  const url = generateQRCodeURL('JBSWY3DPEHPK3PXP', 'user@example.com');
  assert.ok(url.includes('JBSWY3DPEHPK3PXP'), 'URI should contain the secret');
});

test('URI specifies algorithm SHA1', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com');
  assert.ok(url.includes('algorithm=SHA1'));
});

test('URI specifies 6 digits', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com');
  assert.ok(url.includes('digits=6'));
});

test('URI specifies 30 second period', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com');
  assert.ok(url.includes('period=30'));
});

test('default issuer is PetChain', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com');
  assert.ok(url.includes('PetChain'));
});

test('custom issuer overrides default', () => {
  const url = generateQRCodeURL('SECRET', 'user@example.com', 'VetApp');
  assert.ok(url.includes('VetApp'));
  assert.ok(!url.includes('PetChain'));
});

// ── backup code uniqueness (generation simulation) ────────────────

console.log('\nbackup code uniqueness');

test('10 independently generated backup code shapes are all unique', () => {
  // Simulate generating backup codes with random alphanumeric strings
  const generate = () => Array.from({ length: 8 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
  }).join('');

  const codes = Array.from({ length: 10 }, generate);
  const uniqueCodes = new Set(codes);
  // With 36^8 ≈ 2.8 trillion possibilities, collision is astronomically unlikely
  assert.strictEqual(uniqueCodes.size, 10, 'All generated codes should be unique');
});

test('generated backup codes match the expected format', () => {
  const generate = () => Array.from({ length: 8 }, () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars[Math.floor(Math.random() * chars.length)];
  }).join('');

  for (let i = 0; i < 5; i++) {
    const code = generate();
    assert.strictEqual(validateBackupCode(code), true, `Code ${code} should be valid`);
  }
});

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
