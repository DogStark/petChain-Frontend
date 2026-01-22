import { DeviceFingerprintUtil, DeviceFingerprintData } from './device-fingerprint.util';
import * as crypto from 'crypto';

describe('DeviceFingerprintUtil', () => {
  describe('createFingerprint', () => {
    it('should create a consistent fingerprint from device data', () => {
      const data: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip, deflate',
      };

      const fingerprint1 = DeviceFingerprintUtil.createFingerprint(data);
      const fingerprint2 = DeviceFingerprintUtil.createFingerprint(data);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA256 hex string length
    });

    it('should create different fingerprints for different data', () => {
      const data1: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
      };

      const data2: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.2', // Different IP
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
      };

      const fingerprint1 = DeviceFingerprintUtil.createFingerprint(data1);
      const fingerprint2 = DeviceFingerprintUtil.createFingerprint(data2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle missing optional fields', () => {
      const data: DeviceFingerprintData = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const fingerprint = DeviceFingerprintUtil.createFingerprint(data);
      expect(fingerprint).toBeDefined();
      expect(fingerprint).toHaveLength(64);
    });

    it('should handle empty strings', () => {
      const data: DeviceFingerprintData = {
        userAgent: '',
        ipAddress: '',
        acceptLanguage: '',
        acceptEncoding: '',
      };

      const fingerprint = DeviceFingerprintUtil.createFingerprint(data);
      expect(fingerprint).toBeDefined();
      expect(fingerprint).toHaveLength(64);
    });
  });

  describe('extractFromRequest', () => {
    it('should extract device fingerprint data from request', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip, deflate',
        },
        ip: '192.168.1.1',
      };

      const result = DeviceFingerprintUtil.extractFromRequest(mockRequest);

      expect(result).toEqual({
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip, deflate',
      });
    });

    it('should use connection.remoteAddress if ip is not available', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        connection: {
          remoteAddress: '10.0.0.1',
        },
      };

      const result = DeviceFingerprintUtil.extractFromRequest(mockRequest);

      expect(result.ipAddress).toBe('10.0.0.1');
    });

    it('should handle missing headers gracefully', () => {
      const mockRequest = {
        headers: {},
        ip: '192.168.1.1',
      };

      const result = DeviceFingerprintUtil.extractFromRequest(mockRequest);

      expect(result).toEqual({
        userAgent: '',
        ipAddress: '192.168.1.1',
        acceptLanguage: '',
        acceptEncoding: '',
      });
    });

    it('should handle missing ip and connection', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      };

      const result = DeviceFingerprintUtil.extractFromRequest(mockRequest);

      expect(result.ipAddress).toBe('');
    });
  });
});
