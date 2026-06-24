import * as crypto from 'crypto';

// Fixed salt derived from env secret — scrypt provides sufficient computational effort
const TOKEN_SALT = crypto
  .createHash('sha256')
  .update(process.env.TOKEN_HMAC_SECRET || 'change-me-in-production')
  .digest('hex')
  .slice(0, 16);

export class TokenUtil {
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /** Hash a token using scrypt (memory-hard, sufficient computational effort) */
  static hashToken(token: string): string {
    const derived = crypto.scryptSync(token, TOKEN_SALT, 32);
    return derived.toString('hex');
  }

  static verifyToken(token: string, hash: string): boolean {
    try {
      const tokenHash = this.hashToken(token);
      if (tokenHash.length !== hash.length) return false;
      return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
    } catch {
      return false;
    }
  }
}
