import { describe, it, expect } from 'vitest';
import {
  QR_PAYLOAD_VERSION,
  buildQrPayload,
  parseQrPayload,
  verifyQrRoundTrip,
  validateQrPayload,
  type QrPayloadInput,
} from './qrPayload';

const baseInput: QrPayloadInput = {
  profileId: 'profile-123',
  emergencyData: {
    name: 'Jane Doe',
    bloodType: 'O+',
    allergies: ['penicillin'],
    medications: ['insulin'],
    emergencyContact: '+1-555-0100',
  },
  issuedAt: '2024-01-01T00:00:00.000Z',
  expiresAt: '2030-01-01T00:00:00.000Z',
  revoked: false,
};

describe('qrPayload canonical schema', () => {
  it('emits a versioned payload with integrity data', () => {
    const payload = buildQrPayload(baseInput);
    expect(payload.version).toBe(QR_PAYLOAD_VERSION);
    expect(typeof payload.checksum).toBe('string');
    expect(payload.checksum.length).toBeGreaterThan(0);
    expect(payload.profileId).toBe(baseInput.profileId);
  });

  it('produces a stable checksum for identical input (round-trip vector)', () => {
    const a = buildQrPayload(baseInput);
    const b = buildQrPayload(baseInput);
    expect(a.checksum).toBe(b.checksum);
    expect(parseQrPayload(JSON.stringify(a))).toEqual(a);
  });

  it('changes the checksum when the payload content changes', () => {
    const a = buildQrPayload(baseInput);
    const b = buildQrPayload({
      ...baseInput,
      emergencyData: { ...baseInput.emergencyData, bloodType: 'A-' },
    });
    expect(a.checksum).not.toBe(b.checksum);
  });
});

describe('qrPayload decode round-trip', () => {
  it('verifies a valid payload round-trips through encode/decode', () => {
    const payload = buildQrPayload(baseInput);
    const result = verifyQrRoundTrip(payload);
    expect(result.ok).toBe(true);
    expect(result.decoded).toEqual(payload);
  });

  it('detects truncation of the encoded payload', () => {
    const payload = buildQrPayload(baseInput);
    const encoded = JSON.stringify(payload);
    const truncated = encoded.slice(0, Math.floor(encoded.length / 2));
    const result = verifyQrRoundTrip(truncated);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/truncat|invalid|decode/i);
  });

  it('detects a tampered checksum', () => {
    const payload = buildQrPayload(baseInput);
    const tampered = { ...payload, checksum: 'deadbeef' };
    const result = verifyQrRoundTrip(tampered);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/integrity|checksum/i);
  });

  it('handles unicode encoding without corruption', () => {
    const payload = buildQrPayload({
      ...baseInput,
      emergencyData: { ...baseInput.emergencyData, name: 'José 山田 🚑' },
    });
    const result = verifyQrRoundTrip(payload);
    expect(result.ok).toBe(true);
    expect(result.decoded?.emergencyData.name).toBe('José 山田 🚑');
  });
});

describe('qrPayload validation guards', () => {
  it('blocks revoked payloads with an actionable error', () => {
    const payload = buildQrPayload({ ...baseInput, revoked: true });
    const result = validateQrPayload(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/revoked/i);
  });

  it('blocks expired payloads with an actionable error', () => {
    const payload = buildQrPayload({
      ...baseInput,
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    const result = validateQrPayload(payload, new Date('2024-06-01T00:00:00.000Z'));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('blocks oversized payloads with an actionable error', () => {
    const payload = buildQrPayload({
      ...baseInput,
      emergencyData: {
        ...baseInput.emergencyData,
        medications: Array.from({ length: 500 }, (_, i) => `medication-${i}`),
      },
    });
    const result = validateQrPayload(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/oversized|too large/i);
  });

  it('accepts a valid, current payload', () => {
    const payload = buildQrPayload(baseInput);
    const result = validateQrPayload(payload, new Date('2024-06-01T00:00:00.000Z'));
    expect(result.ok).toBe(true);
  });
});

describe('qrPayload rendering constraints', () => {
  it('keeps print scaling within the supported module range', () => {
    const payload = buildQrPayload(baseInput);
    const result = verifyQrRoundTrip(payload, { printScale: 4 });
    expect(result.ok).toBe(true);
    expect(result.printScale).toBe(4);
  });

  it('rejects print scaling outside the supported range', () => {
    const payload = buildQrPayload(baseInput);
    const result = verifyQrRoundTrip(payload, { printScale: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/scale/i);
  });

  it('verifies round-trip in dark mode', () => {
    const payload = buildQrPayload(baseInput);
    const result = verifyQrRoundTrip(payload, { darkMode: true });
    expect(result.ok).toBe(true);
    expect(result.decoded).toEqual(payload);
  });
});
