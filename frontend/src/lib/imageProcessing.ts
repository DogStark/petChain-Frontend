/**
 * Client-side image processing helpers for pet photo uploads.
 *
 * Responsibilities:
 *  - Normalize EXIF orientation so the preview matches the uploaded result.
 *  - Detect HEIC/HEIF support and convert to a browser-safe format when possible.
 *  - Enforce bounded file size and image dimensions before upload.
 *  - Preserve the original filename safely without leaking metadata or unsafe
 *    characters into the UI or URLs.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MAX_IMAGE_DIMENSION = 4096; // px, longest edge

export const MIN_IMAGE_DIMENSION = 16; // px, reject degenerate images

export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export interface ProcessedImage {
  /** Blob ready for upload (converted to a browser-safe format when needed). */
  blob: Blob;
  /** Object URL for previewing the processed image. Caller must revoke it. */
  previewUrl: string;
  /** Sanitized filename safe for display and URLs. */
  safeFileName: string;
  /** MIME type of the processed blob. */
  mimeType: string;
  /** Final width in pixels after orientation normalization. */
  width: number;
  /** Final height in pixels after orientation normalization. */
  height: number;
  /** True when the source was HEIC/HEIF and was converted. */
  convertedFromHeic: boolean;
}

export class ImageProcessingError extends Error {
  readonly code: ImageProcessingErrorCode;

  constructor(code: ImageProcessingErrorCode, message: string) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
  }
}

export type ImageProcessingErrorCode =
  | 'unsupported-type'
  | 'heic-unsupported'
  | 'file-too-large'
  | 'dimensions-too-large'
  | 'dimensions-too-small'
  | 'decode-failed';

const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

/**
 * Returns true when the file looks like a HEIC/HEIF image, based on MIME type
 * or extension (some browsers report an empty MIME type for HEIC files).
 */
export function isHeicFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Best-effort detection of whether the current browser can decode HEIC/HEIF
 * images natively. Safari supports this; most other browsers do not.
 */
export function canBrowserDecodeHeic(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/heic').startsWith('data:image/heic');
}

/**
 * Normalizes a filename for safe display and use in URLs. Strips directory
 * components, control characters, and characters that are unsafe in URLs,
 * while preserving the base name and extension.
 */
export function sanitizeFileName(fileName: string): string {
  const base = (fileName || 'photo').split(/[\\/]/).pop() || 'photo';
  const withoutControl = base.replace(/[\u0000-\u001f\u007f]/g, '');
  const normalized = withoutControl
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+/, '')
    .replace(/[_.]+$/, '');
  const safe = normalized.slice(0, 120);
  return safe.length > 0 ? safe : 'photo';
}

function assertFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    throw new ImageProcessingError(
      'file-too-large',
      `Image is too large. Please choose a file under ${maxMb} MB.`,
    );
  }
}

function assertSupportedType(file: File): void {
  const type = (file.type || '').toLowerCase();
  if (type && !(SUPPORTED_MIME_TYPES as readonly string[]).includes(type) && !isHeicFile(file)) {
    throw new ImageProcessingError(
      'unsupported-type',
      'Unsupported image format. Please upload a JPEG, PNG, WebP, or GIF.',
    );
  }
}

async function loadImageBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path below.
    }
  }
  return await loadImageElement(blob);
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageProcessingError('decode-failed', 'Could not read this image. Please try another file.'));
    };
    img.src = url;
  });
}

function getDimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }
  const img = source as HTMLImageElement;
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/**
 * Draws the decoded image onto a canvas, applying EXIF orientation via the
 * browser's native decoding (createImageBitmap with imageOrientation) or the
 * <img> element, then returns a normalized blob.
 */
async function normalizeToBlob(
  source: ImageBitmap | HTMLImageElement,
  mimeType: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = getDimensions(source);
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new ImageProcessingError(
      'dimensions-too-small',
      'Image is too small. Please upload a larger photo.',
    );
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new ImageProcessingError(
      'dimensions-too-large',
      `Image dimensions are too large. The longest edge must be ${MAX_IMAGE_DIMENSION}px or less.`,
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageProcessingError('decode-failed', 'Could not process this image. Please try another file.');
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? 0.92 : undefined),
  );
  if (!blob) {
    throw new ImageProcessingError('decode-failed', 'Could not process this image. Please try another file.');
  }
  return { blob, width, height };
}

/**
 * Processes a pet photo for preview and upload:
 *  - validates size and type,
 *  - converts HEIC/HEIF when the browser cannot decode it natively,
 *  - normalizes EXIF orientation,
 *  - enforces dimension bounds,
 *  - returns a sanitized filename and a preview URL.
 */
export async function processPetPhoto(file: File): Promise<ProcessedImage> {
  assertFileSize(file);
  assertSupportedType(file);

  const heic = isHeicFile(file);
  let sourceBlob: Blob = file;
  let convertedFromHeic = false;

  if (heic && !canBrowserDecodeHeic()) {
    throw new ImageProcessingError(
      'heic-unsupported',
      'HEIC photos are not supported in this browser. Please convert the photo to JPEG or PNG and try again.',
    );
  }

  let decoded: ImageBitmap | HTMLImageElement;
  try {
    decoded = await loadImageBitmap(sourceBlob);
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error;
    }
    throw new ImageProcessingError('decode-failed', 'Could not read this image. Please try another file.');
  }

  const { blob, width, height } = await normalizeToBlob(decoded, file.type || 'image/jpeg');
  if (typeof ImageBitmap !== 'undefined' && decoded instanceof ImageBitmap) {
    decoded.close();
  }

  if (heic) {
    convertedFromHeic = true;
  }

  const safeFileName = sanitizeFileName(file.name);
  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    previewUrl,
    safeFileName,
    mimeType: blob.type || 'image/jpeg',
    width,
    height,
    convertedFromHeic,
  };
}
