import * as crypto from 'crypto';

export class TokenUtil {
  /**
   * Generate a random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a token for storage
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a token against a hash
   */
  static verifyToken(token: string, hash: string): boolean {
    const tokenHash = this.hashToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(hash),
    );
  }
}
