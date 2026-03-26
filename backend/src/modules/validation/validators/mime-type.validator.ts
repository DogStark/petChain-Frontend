import { Injectable, Logger } from '@nestjs/common';
import {
  ALL_ALLOWED_MIME_TYPES,
  getFileCategoryFromMime,
} from '../constants/file-types.constant';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * MIME Type Validator
 *
 * Validates file MIME types against the allowed whitelist.
 */
@Injectable()
export class MimeTypeValidator {
  private readonly logger = new Logger(MimeTypeValidator.name);
  private readonly allowedMimeTypes: Set<string>;

  constructor() {
    this.allowedMimeTypes = new Set(ALL_ALLOWED_MIME_TYPES);
  }

  /**
   * Validate a file's MIME type
   */
  validate(mimeType: string, filename?: string): ValidationResult {
    if (!mimeType) {
      return {
        valid: false,
        error: 'MIME type is required',
      };
    }

    const normalizedMimeType = mimeType.toLowerCase().trim();

    if (!this.allowedMimeTypes.has(normalizedMimeType)) {
      this.logger.warn(
        `Rejected file with MIME type: ${normalizedMimeType}${filename ? ` (${filename})` : ''}`,
      );
      return {
        valid: false,
        error: `File type '${normalizedMimeType}' is not allowed`,
        details: {
          providedType: normalizedMimeType,
          allowedTypes: Array.from(this.allowedMimeTypes),
        },
      };
    }

    const category = getFileCategoryFromMime(normalizedMimeType);

    this.logger.debug(
      `Accepted file with MIME type: ${normalizedMimeType} (category: ${category})`,
    );

    return {
      valid: true,
      details: {
        mimeType: normalizedMimeType,
        category,
      },
    };
  }

  /**
   * Check if a MIME type is allowed
   */
  isAllowed(mimeType: string): boolean {
    return this.allowedMimeTypes.has(mimeType.toLowerCase().trim());
  }

  /**
   * Get list of allowed MIME types
   */
  getAllowedTypes(): string[] {
    return Array.from(this.allowedMimeTypes);
  }

  /**
   * Validate file extension matches MIME type
   */
  validateExtension(filename: string, mimeType: string): ValidationResult {
    const extension = this.getExtension(filename);
    const expectedExtensions = this.getExpectedExtensions(mimeType);

    if (expectedExtensions.length === 0) {
      return { valid: true }; // No extension validation for unknown types
    }

    if (!expectedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension '.${extension}' does not match MIME type '${mimeType}'`,
        details: {
          extension,
          expectedExtensions,
          mimeType,
        },
      };
    }

    return { valid: true };
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  private getExpectedExtensions(mimeType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['docx'],
      'video/mp4': ['mp4', 'm4v'],
      'video/quicktime': ['mov', 'qt'],
    };

    return extensionMap[mimeType.toLowerCase()] || [];
  }
}
