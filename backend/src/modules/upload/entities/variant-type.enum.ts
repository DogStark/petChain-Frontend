/**
 * File Variant Type Enum
 * Categorizes processed variants of an uploaded file
 */
export enum VariantType {
  /** Original uploaded file */
  ORIGINAL = 'ORIGINAL',

  /** Small thumbnail (150px) */
  THUMBNAIL = 'THUMBNAIL',

  /** Small size (400px) */
  SMALL = 'SMALL',

  /** Medium size (800px) */
  MEDIUM = 'MEDIUM',

  /** Large size (1200px) */
  LARGE = 'LARGE',

  /** Compressed version */
  COMPRESSED = 'COMPRESSED',

  /** Version with watermark applied */
  WATERMARKED = 'WATERMARKED',

  /** Video preview/trailer */
  PREVIEW = 'PREVIEW',

  /** WebP format version */
  WEBP = 'WEBP',

  /** Transcoded video version */
  TRANSCODED = 'TRANSCODED',
}
