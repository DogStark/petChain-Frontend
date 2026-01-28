import * as crypto from 'crypto';

export interface DeviceFingerprintData {
  userAgent: string;
  ipAddress: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
}

export class DeviceFingerprintUtil {
  /**
   * Create a device fingerprint hash from request data
   */
  static createFingerprint(data: DeviceFingerprintData): string {
    const fingerprintString = [
      data.userAgent || '',
      data.ipAddress || '',
      data.acceptLanguage || '',
      data.acceptEncoding || '',
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Extract device fingerprint data from Express request
   */
  static extractFromRequest(req: any): DeviceFingerprintData {
    return {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection?.remoteAddress || '',
      acceptLanguage: req.headers['accept-language'] || '',
      acceptEncoding: req.headers['accept-encoding'] || '',
    };
  }
}
