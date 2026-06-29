import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../interfaces/email-service.interface';

@Injectable()
export class EmailServiceImpl implements EmailService {
  private readonly logger = new Logger(EmailServiceImpl.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    // TODO: Implement email sending logic
    // This is a placeholder implementation
    this.logger.log(
      `Verification email would be sent to ${email} with token: ${token}`,
    );
    this.logger.log(
      `Verification link: http://localhost:3000/verify-email?token=${token}`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // TODO: Implement email sending logic
    // This is a placeholder implementation
    this.logger.log(
      `Password reset email would be sent to ${email} with token: ${token}`,
    );
    this.logger.log(
      `Reset link: http://localhost:3000/reset-password?token=${token}`,
    );
  }
}
