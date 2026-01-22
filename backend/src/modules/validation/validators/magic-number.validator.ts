import { Injectable, Logger } from '@nestjs/common';
import { MAGIC_NUMBERS } from '../constants/file-types.constant';
import { ValidationResult } from './mime-type.validator';

/**
 * Magic Number Validator
 *
 * Validates file content by checking magic bytes (file signatures).
 * This prevents extension spoofing attacks where a malicious file
 * is renamed to have a safe extension.
 */
@Injectable()
export class MagicNumberValidator {
  private readonly logger = new Logger(MagicNumberValidator.name);

  /**
   * Validate file content against expected magic numbers for the MIME type
   */
  validate(buffer: Buffer, claimedMimeType: string): ValidationResult {
    if (!buffer || buffer.length === 0) {
      return {
        valid: false,
        error: 'Empty file buffer',
      };
    }

    const expectedSignatures = MAGIC_NUMBERS[claimedMimeType.toLowerCase()];

    if (!expectedSignatures || expectedSignatures.length === 0) {
      // No magic number validation for this type
      this.logger.debug(
        `No magic number validation for MIME type: ${claimedMimeType}`,
      );
      return { valid: true };
    }

    // Check if any of the expected signatures match
    for (const signature of expectedSignatures) {
      if (
        this.matchesSignature(buffer, signature.bytes, signature.offset || 0)
      ) {
        // Additional validation for WebP
        if (claimedMimeType === 'image/webp') {
          if (!this.validateWebP(buffer)) {
            continue; // Try next signature
          }
        }

        this.logger.debug(
          `Magic number validation passed for: ${claimedMimeType}`,
        );
        return {
          valid: true,
          details: {
            matchedSignature: signature.bytes
              .map((b) => b.toString(16))
              .join(' '),
          },
        };
      }
    }

    // Detect actual file type for better error message
    const detectedType = this.detectFileType(buffer);

    this.logger.warn(
      `Magic number mismatch: claimed ${claimedMimeType}, detected ${detectedType || 'unknown'}`,
    );

    return {
      valid: false,
      error: `File content does not match claimed type '${claimedMimeType}'`,
      details: {
        claimedType: claimedMimeType,
        detectedType: detectedType || 'unknown',
        hint: 'The file may have been renamed or is corrupted',
      },
    };
  }

  /**
   * Detect file type from buffer
   */
  detectFileType(buffer: Buffer): string | null {
    for (const [mimeType, signatures] of Object.entries(MAGIC_NUMBERS)) {
      for (const signature of signatures) {
        if (
          this.matchesSignature(buffer, signature.bytes, signature.offset || 0)
        ) {
          // Additional check for WebP
          if (mimeType === 'image/webp' && !this.validateWebP(buffer)) {
            continue;
          }
          return mimeType;
        }
      }
    }
    return null;
  }

  /**
   * Check if buffer matches a byte signature at a given offset
   */
  private matchesSignature(
    buffer: Buffer,
    signature: number[],
    offset: number,
  ): boolean {
    if (buffer.length < offset + signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Additional validation for WebP files
   * WebP files have RIFF at offset 0 and WEBP at offset 8
   */
  private validateWebP(buffer: Buffer): boolean {
    if (buffer.length < 12) {
      return false;
    }

    // Check for WEBP at offset 8
    const webpSignature = [0x57, 0x45, 0x42, 0x50]; // WEBP
    return this.matchesSignature(buffer, webpSignature, 8);
  }

  /**
   * Validate that a file is safe (not executable or script)
   */
  validateNotExecutable(buffer: Buffer): ValidationResult {
    // Check for common executable signatures
    const dangerousSignatures = [
      { name: 'EXE/DLL', bytes: [0x4d, 0x5a] }, // MZ header
      { name: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // ELF header
      { name: 'Mach-O 32', bytes: [0xfe, 0xed, 0xfa, 0xce] },
      { name: 'Mach-O 64', bytes: [0xfe, 0xed, 0xfa, 0xcf] },
      { name: 'Shell script', bytes: [0x23, 0x21] }, // #!
    ];

    for (const sig of dangerousSignatures) {
      if (this.matchesSignature(buffer, sig.bytes, 0)) {
        this.logger.warn(`Detected dangerous file type: ${sig.name}`);
        return {
          valid: false,
          error: `Executable files are not allowed (detected: ${sig.name})`,
          details: { detectedType: sig.name },
        };
      }
    }

    return { valid: true };
  }
}
