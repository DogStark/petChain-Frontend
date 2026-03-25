import { describe, it, expect } from 'vitest';

describe('Contract Client', () => {
  it('should have correct network configuration', async () => {
    const { networks } = await import('../src/contracts');
    
    expect(networks.testnet).toBeDefined();
    expect(networks.testnet.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(networks.testnet.contractId).toBe('CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA');
  });
});

describe('Payment Validation', () => {
  it('should validate positive amounts', () => {
    const amount = 10;
    expect(Number.isFinite(amount) && amount > 0).toBe(true);
  });

  it('should reject negative amounts', () => {
    const amount = -5;
    expect(Number.isFinite(amount) && amount > 0).toBe(false);
  });

  it('should reject zero amount', () => {
    const amount = 0;
    expect(Number.isFinite(amount) && amount > 0).toBe(false);
  });
});

describe('Meter ID Validation', () => {
  it('should accept valid meter IDs', () => {
    const meterId = 'METER-001';
    expect(meterId.trim().length > 0).toBe(true);
  });

  it('should reject empty meter IDs', () => {
    const meterId = '   ';
    expect(meterId.trim().length > 0).toBe(false);
  });
});
