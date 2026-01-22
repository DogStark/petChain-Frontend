export abstract class EmailService {
  /**
   * Send email verification email
   */
  abstract sendVerificationEmail(email: string, token: string): Promise<void>;
  abstract sendPasswordResetEmail(email: string, token: string): Promise<void>;
}
