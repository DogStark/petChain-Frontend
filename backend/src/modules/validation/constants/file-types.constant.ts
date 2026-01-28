/**
 * Allowed MIME types for file uploads in PetChain
 * Organized by file category
 */
export const ALLOWED_MIME_TYPES = {
  // Images - Pet photos, QR codes
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],

  // Documents - Medical docs, Vaccination certs
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],

  // Videos - Pet behavior tracking
  VIDEO: ['video/mp4', 'video/quicktime'],
} as const;

/**
 * Flattened array of all allowed MIME types
 */
export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES.IMAGE,
  ...ALLOWED_MIME_TYPES.DOCUMENT,
  ...ALLOWED_MIME_TYPES.VIDEO,
];

/**
 * Magic numbers (file signatures) for validating file content
 * Maps MIME types to their expected magic byte sequences
 */
export const MAGIC_NUMBERS: Record<
  string,
  { bytes: number[]; offset?: number }[]
> = {
  // JPEG - starts with FF D8 FF
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],

  // PNG - starts with 89 50 4E 47 0D 0A 1A 0A
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],

  // WebP - starts with RIFF....WEBP
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF at offset 0
    // WEBP at offset 8 is checked separately
  ],

  // PDF - starts with %PDF
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }],

  // DOC (old format) - starts with D0 CF 11 E0 (OLE compound document)
  'application/msword': [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  ],

  // DOCX - starts with PK (ZIP archive)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],

  // MP4 - has ftyp at offset 4
  'video/mp4': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
  ],

  // MOV (QuickTime) - has ftyp at offset 4
  'video/quicktime': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
  ],
};

/**
 * Maximum file sizes by category (in bytes)
 */
export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024, // 10MB for images
  DOCUMENT: 20 * 1024 * 1024, // 20MB for documents
  VIDEO: 50 * 1024 * 1024, // 50MB for videos
  DEFAULT: 50 * 1024 * 1024, // 50MB default
} as const;

/**
 * Get file category from MIME type
 */
export function getFileCategoryFromMime(
  mimeType: string,
): 'IMAGE' | 'DOCUMENT' | 'VIDEO' | null {
  if (
    ALLOWED_MIME_TYPES.IMAGE.includes(
      mimeType as (typeof ALLOWED_MIME_TYPES.IMAGE)[number],
    )
  ) {
    return 'IMAGE';
  }
  if (
    ALLOWED_MIME_TYPES.DOCUMENT.includes(
      mimeType as (typeof ALLOWED_MIME_TYPES.DOCUMENT)[number],
    )
  ) {
    return 'DOCUMENT';
  }
  if (
    ALLOWED_MIME_TYPES.VIDEO.includes(
      mimeType as (typeof ALLOWED_MIME_TYPES.VIDEO)[number],
    )
  ) {
    return 'VIDEO';
  }
  return null;
}
