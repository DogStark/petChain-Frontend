/**
 * Email Service Interface
 */
export interface IEmailService {
  /**
   * Send email verification email
   */
  sendVerificationEmail(email: string, token: string): Promise<void>;

  /**
   * Send password reset email
   */
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

/**
 * Injection token for email service
 */
export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');

/**
 * Type alias for backward compatibility
 */
export type EmailService = IEmailService;
