import { Injectable, Logger } from '@nestjs/common';
import {
  MAX_FILE_SIZES,
  getFileCategoryFromMime,
} from '../constants/file-types.constant';
import { ValidationResult } from './mime-type.validator';

/**
 * File Size Validator
 *
 * Validates file sizes against category-specific limits.
 */
@Injectable()
export class FileSizeValidator {
  private readonly logger = new Logger(FileSizeValidator.name);

  /**
   * Validate file size for a given MIME type
   */
  validate(sizeBytes: number, mimeType: string): ValidationResult {
    if (sizeBytes <= 0) {
      return {
        valid: false,
        error: 'File size must be greater than 0',
      };
    }

    const category = getFileCategoryFromMime(mimeType);
    const maxSize = this.getMaxSize(category);

    if (sizeBytes > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      const actualSizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

      this.logger.warn(
        `File size ${actualSizeMB}MB exceeds limit of ${maxSizeMB}MB for category ${category || 'DEFAULT'}`,
      );

      return {
        valid: false,
        error: `File size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB) for ${category || 'this file type'}`,
        details: {
          sizeBytes,
          maxSizeBytes: maxSize,
          category,
        },
      };
    }

    return {
      valid: true,
      details: {
        sizeBytes,
        maxSizeBytes: maxSize,
        category,
        utilizationPercent: ((sizeBytes / maxSize) * 100).toFixed(1),
      },
    };
  }

  /**
   * Get maximum file size for a category
   */
  getMaxSize(category: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | null): number {
    if (!category) {
      return MAX_FILE_SIZES.DEFAULT;
    }
    return MAX_FILE_SIZES[category] || MAX_FILE_SIZES.DEFAULT;
  }

  /**
   * Get all size limits
   */
  getSizeLimits(): Record<string, number> {
    return { ...MAX_FILE_SIZES };
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
