import { randomBytes } from 'crypto';
import { parse } from 'path';

/**
 * File Management Utilities
 *
 * Helper functions for file operations, validation, and transformation
 */

/**
 * Generate a secure share token
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate storage key for organizing files
 */
export function generateStorageKey(
  userId: string,
  petId: string | undefined,
  originalFilename: string,
): string {
  const timestamp = Date.now();
  const filename = parse(originalFilename).name;
  const ext = parse(originalFilename).ext;

  if (petId) {
    return `uploads/${userId}/pets/${petId}/${timestamp}-${filename}${ext}`;
  }

  return `uploads/${userId}/${timestamp}-${filename}${ext}`;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove unsafe characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

/**
 * Convert bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMimeType(
  mimeType: string,
  allowedTypes: string[],
): boolean {
  // Exact match
  if (allowedTypes.includes(mimeType)) {
    return true;
  }

  // Wildcard match (e.g., 'image/*')
  return allowedTypes.some((allowed) => {
    if (allowed.endsWith('/*')) {
      const [type] = allowed.split('/');
      return mimeType.startsWith(type + '/');
    }
    return false;
  });
}

/**
 * Extract file extension
 */
export function getFileExtension(filename: string): string {
  const ext = parse(filename).ext.toLowerCase();
  return ext.startsWith('.') ? ext.substring(1) : ext;
}

/**
 * Detect file type from MIME type
 */
export function detectFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }
  if (mimeType.startsWith('video/')) {
    return 'VIDEO';
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('sheet')
  ) {
    return 'DOCUMENT';
  }
  if (mimeType.includes('pdf')) {
    return 'DOCUMENT';
  }
  return 'DOCUMENT';
}

/**
 * Check if file is an image
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if file is a video
 */
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Check if file is a document
 */
export function isDocument(mimeType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument',
    'text/plain',
  ];
  return documentTypes.some((type) => mimeType.includes(type));
}

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Check if date is expired
 */
export function isExpired(expirationDate: Date | null | undefined): boolean {
  if (!expirationDate) {
    return false;
  }
  return new Date() > expirationDate;
}

/**
 * Format file info for logging
 */
export function formatFileInfo(file: any): string {
  return `${file.originalFilename} (${formatBytes(file.sizeBytes)}, ${file.mimeType})`;
}

/**
 * Validate file size
 */
export function validateFileSize(
  sizeBytes: number,
  maxSizeMb: number,
): { valid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  if (sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxSizeMb}MB. Actual size: ${formatBytes(sizeBytes)}`,
    };
  }
  return { valid: true };
}

/**
 * Build file access audit log entry
 */
export function buildAccessAuditLog(
  fileId: string,
  userId: string,
  action: string,
  details?: any,
): any {
  return {
    timestamp: new Date(),
    fileId,
    userId,
    action,
    details,
    ipAddress: details?.ipAddress,
    userAgent: details?.userAgent,
  };
}

/**
 * Get permission display name
 */
export function getPermissionDisplayName(permission: string): string {
  const names: Record<string, string> = {
    owner: 'Owner',
    editor: 'Editor',
    viewer: 'Viewer',
    commenter: 'Commenter',
  };
  return names[permission.toLowerCase()] || permission;
}

/**
 * Get access level display name
 */
export function getAccessLevelDisplayName(level: string): string {
  const names: Record<string, string> = {
    private: 'Private',
    link: 'Link Share',
    public: 'Public',
  };
  return names[level.toLowerCase()] || level;
}
