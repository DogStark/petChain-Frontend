/**
 * File Type Enum
 * Categorizes files by their general type for processing logic
 */
export enum FileType {
  /** Image files (JPEG, PNG, WebP) */
  IMAGE = 'IMAGE',

  /** Document files (PDF, DOC, DOCX) */
  DOCUMENT = 'DOCUMENT',

  /** Video files (MP4, MOV) */
  VIDEO = 'VIDEO',
}

/**
 * Get file type from MIME type
 */
export function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) {
    return FileType.IMAGE;
  }
  if (mimeType.startsWith('video/')) {
    return FileType.VIDEO;
  }
  return FileType.DOCUMENT;
}
