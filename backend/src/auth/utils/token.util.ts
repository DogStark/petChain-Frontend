import * as crypto from 'crypto';

// HMAC secret for token hashing — must be set in environment
const TOKEN_HMAC_SECRET = process.env.TOKEN_HMAC_SECRET || 'change-me-in-production';

export class TokenUtil {
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /** Hash a token using HMAC-SHA256 for storage */
  static hashToken(token: string): string {
    return crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(token).digest('hex');
  }

  static verifyToken(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    if (tokenHash.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
  }
}
