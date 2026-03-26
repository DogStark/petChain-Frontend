import { Module, Global } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { MimeTypeValidator } from './validators/mime-type.validator';
import { MagicNumberValidator } from './validators/magic-number.validator';
import { FileSizeValidator } from './validators/file-size.validator';

/**
 * Validation Module
 *
 * Provides file validation capabilities across the application.
 *
 * Features:
 * - MIME type whitelist validation
 * - Magic number (file signature) validation
 * - File size validation by category
 * - Extension mismatch detection
 * - Executable file detection
 */
@Global()
@Module({
  providers: [
    ValidationService,
    MimeTypeValidator,
    MagicNumberValidator,
    FileSizeValidator,
  ],
  exports: [ValidationService],
})
export class ValidationModule {}
