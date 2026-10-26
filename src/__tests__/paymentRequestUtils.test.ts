import {
  isSafePublicAddress,
  isValidPaymentAmount,
  encodePaymentRequestPayload,
  decodePaymentRequestPayload,
  isPaymentRequestExpired,
  formatExpiryTimeRemaining,
  buildPaymentRequestUrl,
} from '@/utils/paymentRequest';
import { PaymentRequest } from '@/types/paymentRequest';

describe('Payment Request Utilities', () => {
  const validPubKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  const secretKey = 'SB2Y7WJWW3XUOBW5I2C365R4R7E436H5763V7D737P57G7Q66M35Y6Z7';

  describe('isSafePublicAddress', () => {
    it('accepts valid Stellar public key starting with G', () => {
      expect(isSafePublicAddress(validPubKey)).toBe(true);
    });

    it('strictly rejects secret seed starting with S to preserve privacy', () => {
      expect(isSafePublicAddress(secretKey)).toBe(false);
    });

    it('rejects empty or invalid addresses', () => {
      expect(isSafePublicAddress('')).toBe(false);
      expect(isSafePublicAddress('invalid-address')).toBe(false);
      expect(isSafePublicAddress('12345')).toBe(false);
    });
  });

  describe('isValidPaymentAmount', () => {
    it('accepts positive standard amounts', () => {
      expect(isValidPaymentAmount('10.5')).toBe(true);
      expect(isValidPaymentAmount('100')).toBe(true);
      expect(isValidPaymentAmount('0.0000001')).toBe(true);
    });

    it('rejects zero or negative amounts', () => {
      expect(isValidPaymentAmount('0')).toBe(false);
      expect(isValidPaymentAmount('-5')).toBe(false);
      expect(isValidPaymentAmount('-0.1')).toBe(false);
    });

    it('rejects non-numeric inputs or NaN', () => {
      expect(isValidPaymentAmount('abc')).toBe(false);
      expect(isValidPaymentAmount('')).toBe(false);
    });
  });

  describe('encodePaymentRequestPayload and decodePaymentRequestPayload', () => {
    it('encodes and decodes a payment request payload correctly', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
      const createdAt = new Date(now).toISOString();

      const req: PaymentRequest = {
        id: 'req_123',
        asset: 'XLM',
        amount: '50.25',
        destination: validPubKey,
        memo: 'Medication',
        memoType: 'text',
        note: 'Dr Smith prescription',
        createdAt,
        expiresAt,
        status: 'active',
      };

      const encoded = encodePaymentRequestPayload(req);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(10);

      const decoded = decodePaymentRequestPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(req.id);
      expect(decoded?.asset).toBe('XLM');
      expect(decoded?.amount).toBe('50.25');
      expect(decoded?.destination).toBe(validPubKey);
      expect(decoded?.memo).toBe('Medication');
      expect(decoded?.note).toBe('Dr Smith prescription');
      expect(decoded?.status).toBe('active');
    });

    it('throws security error if destination starts with S', () => {
      const req: PaymentRequest = {
        id: 'req_unsafe',
        asset: 'XLM',
        amount: '10',
        destination: secretKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        status: 'active',
      };

      expect(() => encodePaymentRequestPayload(req)).toThrow(/Security Error/);
    });

    it('returns null on decoding malformed payload', () => {
      expect(decodePaymentRequestPayload('not-a-valid-base64-payload')).toBeNull();
      expect(decodePaymentRequestPayload('')).toBeNull();
    });

    it('detects expired status when exp is in the past', () => {
      const pastTime = Date.now() - 50000;
      const req: PaymentRequest = {
        id: 'req_past',
        asset: 'USDC',
        amount: '20',
        destination: validPubKey,
        createdAt: new Date(pastTime - 60000).toISOString(),
        expiresAt: new Date(pastTime).toISOString(),
        status: 'active',
      };

      const encoded = encodePaymentRequestPayload(req);
      const decoded = decodePaymentRequestPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.status).toBe('expired');
    });
  });

  describe('isPaymentRequestExpired', () => {
    it('returns true when expiry timestamp has passed', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(isPaymentRequestExpired({ expiresAt: past })).toBe(true);
    });

    it('returns false when expiry timestamp is in the future', () => {
      const future = new Date(Date.now() + 100000).toISOString();
      expect(isPaymentRequestExpired({ expiresAt: future })).toBe(false);
    });
  });

  describe('formatExpiryTimeRemaining', () => {
    it('returns Expired when time is in the past', () => {
      const past = new Date(Date.now() - 5000).toISOString();
      expect(formatExpiryTimeRemaining(past)).toBe('Expired');
    });

    it('formats minutes and seconds remaining', () => {
      const future = new Date(Date.now() + 125 * 1000).toISOString();
      const res = formatExpiryTimeRemaining(future);
      expect(res).toContain('m');
      expect(res).toContain('remaining');
    });

    it('formats hours remaining for longer durations', () => {
      const future = new Date(Date.now() + 3600 * 2 * 1000).toISOString();
      const res = formatExpiryTimeRemaining(future);
      expect(res).toContain('h');
      expect(res).toContain('remaining');
    });
  });

  describe('buildPaymentRequestUrl', () => {
    it('constructs url with /pay/request route', () => {
      const req: PaymentRequest = {
        id: 'req_url_test',
        asset: 'XLM',
        amount: '15',
        destination: validPubKey,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        status: 'active',
      };

      const url = buildPaymentRequestUrl(req, 'https://petchain.app');
      expect(url.startsWith('https://petchain.app/pay/request?req=')).toBe(true);
      expect(url).not.toContain(secretKey);
    });
  });
});
