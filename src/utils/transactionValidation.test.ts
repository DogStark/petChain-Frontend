/**
 * Tests for pre-signing transaction validation (issue #854).
 * Malformed destinations, unsafe amounts, and ambiguous memos must be rejected.
 */
import { isValidStellarAddress, validateMemo, validateTransactionInput, memoByteLength, MAX_MEMO_BYTES } from './transactionValidation';

// A structurally valid Stellar ed25519 public key (deterministic fixture; never
// a real wallet/credential).
const validAddress = 'GAJ5TC63VPIFBIY2IRHDCNWZJQVLKWC7ZM6S77DCXWZEYTYLYMKJJGPM';

describe('isValidStellarAddress', () => {
  it('accepts a real Stellar public key', () => {
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('rejects malformed and adversarial destinations', () => {
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('G')).toBe(false);
    expect(isValidStellarAddress(validAddress.slice(0, 55))).toBe(false);
    expect(isValidStellarAddress(validAddress.toLowerCase())).toBe(false);
    expect(isValidStellarAddress('A'.repeat(56))).toBe(false);
    expect(isValidStellarAddress('0'.repeat(56))).toBe(false);
  });

  it('rejects surrounding whitespace so the signed destination is unambiguous', () => {
    expect(isValidStellarAddress(` ${validAddress}`)).toBe(false);
    expect(isValidStellarAddress(`${validAddress} `)).toBe(false);
  });
});

describe('memoByteLength', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(memoByteLength('hello')).toBe(5);
    expect(memoByteLength('😀')).toBe(4);
    expect(memoByteLength('日本語')).toBe(9);
  });
});

describe('validateMemo', () => {
  it('accepts empty memos and short text', () => {
    expect(validateMemo('')).toBeNull();
    expect(validateMemo('Payment for vet visit')).toBeNull();
  });

  it('enforces the 28-byte Stellar text memo limit', () => {
    const twentyEightBytes = 'a'.repeat(28);
    expect(memoByteLength(twentyEightBytes)).toBe(MAX_MEMO_BYTES);
    expect(validateMemo(twentyEightBytes)).toBeNull();
    expect(validateMemo('a'.repeat(29))).toMatch(/28 bytes/);
  });

  it('rejects multibyte memos that exceed 28 bytes even with few characters', () => {
    expect(validateMemo('😀'.repeat(7))).toBeNull(); // 28 bytes exactly
    expect(validateMemo('😀'.repeat(8))).toMatch(/28 bytes/); // 32 bytes
  });

  it('rejects control characters', () => {
    expect(validateMemo('pay\u0000ment')).toMatch(/control characters/);
    expect(validateMemo('pay\tment')).toMatch(/control characters/);
    expect(validateMemo('pay\nment')).toMatch(/control characters/);
  });

  it('rejects leading or trailing whitespace', () => {
    expect(validateMemo(' memo')).toMatch(/whitespace/);
    expect(validateMemo('memo ')).toMatch(/whitespace/);
  });

  it('rejects ambiguous 64-character hex memos that look like a Memo.hash', () => {
    expect(validateMemo('a'.repeat(64))).toMatch(/64-character hash/);
    expect(validateMemo('0123456789abcdef'.repeat(4))).toMatch(/64-character hash/);
  });
});

describe('validateTransactionInput', () => {
  const baseInput = {
    destination: validAddress,
    amount: '10',
    memo: '',
  };

  it('accepts a valid payment intent', () => {
    expect(validateTransactionInput(baseInput)).toBeNull();
  });

  it('rejects an empty destination', () => {
    expect(validateTransactionInput({ ...baseInput, destination: '' })).toMatch(/required/);
  });

  it('rejects an invalid destination', () => {
    expect(validateTransactionInput({ ...baseInput, destination: 'GINVALID' })).toMatch(/public key/);
  });

  it('rejects sending to your own address', () => {
    expect(
      validateTransactionInput({ ...baseInput, sourcePublicKey: validAddress })
    ).toMatch(/own address/);
  });

  it('rejects unsafe amounts', () => {
    expect(validateTransactionInput({ ...baseInput, amount: '' })).toMatch(/positive amount/);
    expect(validateTransactionInput({ ...baseInput, amount: '0' })).toMatch(/decimal/);
    expect(validateTransactionInput({ ...baseInput, amount: '-5' })).toMatch(/decimal/);
    expect(validateTransactionInput({ ...baseInput, amount: '0.00000001' })).toMatch(/decimal/);
    expect(validateTransactionInput({ ...baseInput, amount: '1e7' })).toMatch(/decimal/);
  });

  it('rejects amounts exceeding the available balance without float math', () => {
    expect(
      validateTransactionInput({ ...baseInput, amount: '9.9999999', maxAmount: '9.9999998' })
    ).toMatch(/Insufficient balance/);
    expect(validateTransactionInput({ ...baseInput, amount: '9.9999999', maxAmount: '9.9999999' })).toBeNull();
  });

  it('propagates memo validation errors', () => {
    expect(
      validateTransactionInput({ ...baseInput, memo: 'x'.repeat(29) })
    ).toMatch(/28 bytes/);
    expect(
      validateTransactionInput({ ...baseInput, memo: 'a'.repeat(64) })
    ).toMatch(/64-character hash/);
  });
});
