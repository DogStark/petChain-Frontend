import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  MimeTypeValidator,
  ValidationResult,
} from './validators/mime-type.validator';
import { MagicNumberValidator } from './validators/magic-number.validator';
import { FileSizeValidator } from './validators/file-size.validator';

/**
 * Complete validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    mimeType?: ValidationResult;
    magicNumber?: ValidationResult;
    fileSize?: ValidationResult;
    extension?: ValidationResult;
    security?: ValidationResult;
  };
}

/**
 * Validation Service
 *
 * Orchestrates all file validation checks including:
 * - MIME type validation
 * - Magic number (file signature) validation
 * - File size validation
 * - Extension validation
 * - Security checks (no executables)
 */
@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private readonly mimeTypeValidator: MimeTypeValidator,
    private readonly magicNumberValidator: MagicNumberValidator,
    private readonly fileSizeValidator: FileSizeValidator,
  ) {}

  /**
   * Validate a file buffer with all checks
   */
  async validateFile(
    buffer: Buffer,
    filename: string,
    claimedMimeType: string,
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: FileValidationResult['details'] = {};

    // 1. MIME type validation
    const mimeResult = this.mimeTypeValidator.validate(
      claimedMimeType,
      filename,
    );
    details.mimeType = mimeResult;
    if (!mimeResult.valid) {
      errors.push(mimeResult.error!);
    }

    // 2. Extension validation
    const extResult = this.mimeTypeValidator.validateExtension(
      filename,
      claimedMimeType,
    );
    details.extension = extResult;
    if (!extResult.valid) {
      warnings.push(extResult.error!); // Warning, not error - extension mismatch is suspicious but not blocking
    }

    // 3. Magic number validation
    const magicResult = this.magicNumberValidator.validate(
      buffer,
      claimedMimeType,
    );
    details.magicNumber = magicResult;
    if (!magicResult.valid) {
      errors.push(magicResult.error!);
    }

    // 4. File size validation
    const sizeResult = this.fileSizeValidator.validate(
      buffer.length,
      claimedMimeType,
    );
    details.fileSize = sizeResult;
    if (!sizeResult.valid) {
      errors.push(sizeResult.error!);
    }

    // 5. Security check - no executables
    const securityResult =
      this.magicNumberValidator.validateNotExecutable(buffer);
    details.security = securityResult;
    if (!securityResult.valid) {
      errors.push(securityResult.error!);
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      this.logger.warn(
        `File validation failed for ${filename}: ${errors.join('; ')}`,
      );
    } else {
      this.logger.debug(`File validation passed for ${filename}`);
    }

    return {
      valid: isValid,
      errors,
      warnings,
      details,
    };
  }

  /**
   * Validate and throw if invalid
   */
  async validateFileOrThrow(
    buffer: Buffer,
    filename: string,
    claimedMimeType: string,
  ): Promise<FileValidationResult> {
    const result = await this.validateFile(buffer, filename, claimedMimeType);

    if (!result.valid) {
      throw new BadRequestException({
        message: 'File validation failed',
        errors: result.errors,
        warnings: result.warnings,
      });
    }

    return result;
  }

  /**
   * Quick check if MIME type is allowed
   */
  isMimeTypeAllowed(mimeType: string): boolean {
    return this.mimeTypeValidator.isAllowed(mimeType);
  }

  /**
   * Get allowed MIME types
   */
  getAllowedMimeTypes(): string[] {
    return this.mimeTypeValidator.getAllowedTypes();
  }

  /**
   * Get size limits
   */
  getSizeLimits(): Record<string, number> {
    return this.fileSizeValidator.getSizeLimits();
  }

  /**
   * Detect actual file type from buffer
   */
  detectFileType(buffer: Buffer): string | null {
    return this.magicNumberValidator.detectFileType(buffer);
  }
}
