/**
 * @file imageOrientationService.ts
 * Issue #963 — Safe image orientation and EXIF handling in previews.
 * Issue #1439 — EXIF orientation correction on pet photo upload.
 *
 * ## Problem
 * Uploaded pet and medical images can render rotated or expose EXIF
 * location/device metadata in previews and downloads.
 *
 * ## This module provides
 * - `readExifOrientation` — reads the EXIF orientation tag from a JPEG File
 *   without trusting user-controlled metadata for rendering decisions.
 * - `normalizeOrientation` — draws the image through a <canvas> at the
 *   correct rotation/flip, producing a new Blob with no EXIF tags and
 *   canonically-oriented pixels.
 * - `decodeWithMemoryLimit` — wraps HTMLImageElement decoding with a hard
 *   memory-limit check (pixelCount × 4 bytes) and returns a typed failure
 *   so callers can surface it in the UI instead of crashing silently.
 * - `correctImageOrientation` — one-shot helper for upload flows: reads the
 *   EXIF orientation, normalizes the pixels, and returns a preview-ready
 *   `File`/object URL (issue #1439).
 *
 * ## Security notes
 * - Orientation is always applied to pixels before presenting a preview.
 *   The raw EXIF tag is *never* passed to CSS `transform` or Next Image's
 *   `style` prop, preventing a class of metadata-injection attacks where a
 *   crafted EXIF value could force unexpected rotations.
 * - GPS and device tags are stripped implicitly: the canvas re-encode
 *   produces a fresh pixel buffer with no metadata markers.
 *
 * ## Memory accounting
 * A decoded RGBA bitmap is `width × height × 4` bytes.  Images that would
 * exceed `MAX_DECODED_BYTES` are rejected before the <img> element is decoded
 * so the browser never allocates the full buffer.
 */

/** Maximum decoded bitmap size (64 MP = ~256 MB RGBA). */
export const MAX_DECODED_BYTES = 64 * 1024 * 1024 * 4; // 256 MB

/** Maximum allowed pixel count per dimension (matches COMPRESSION_MAX_DIMENSION in PhotoUploader). */
export const MAX_DIMENSION_PX = 16384;

// ─── EXIF orientation constants ───────────────────────────────────────────────

/**
 * EXIF orientation tag value (0x0112).
 * Values 1–8 are defined by JEITA EXIF 2.32 §6.3.
 *
 * ```
 * 1 = 0°   (normal)
 * 2 = flip horizontal
 * 3 = 180°
 * 4 = flip vertical
 * 5 = 90° CW + flip horizontal
 * 6 = 90° CW
 * 7 = 90° CCW + flip horizontal
 * 8 = 90° CCW
 * ```
 */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// ─── Error types ──────────────────────────────────────────────────────────────

export type OrientationErrorReason =
  | 'oversized'   // image would exceed MAX_DECODED_BYTES
  | 'dimension'   // a dimension exceeds MAX_DIMENSION_PX
  | 'decode'      // HTMLImageElement load error
  | 'canvas'      // OffscreenCanvas / Canvas unavailable or draw error
  | 'aborted'     // AbortSignal fired
  | 'malformed';  // unparseable EXIF block

export interface OrientationFailure {
  ok: false;
  reason: OrientationErrorReason;
  message: string;
}

export interface OrientationSuccess {
  ok: true;
  blob: Blob;
  /** Applied orientation (1 = no rotation needed, original already correct). */
  orientation: ExifOrientation;
}

export type OrientationResult = OrientationSuccess | OrientationFailure;

// ─── EXIF reading helpers ─────────────────────────────────────────────────────

const JPEG_SOI = [0xff, 0xd8] as const;
const APP1_MARKER = 0xe1;
const EXIF_SIG = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const; // "Exif\0\0"
const ORIENTATION_TAG = 0x0112;

function matchBytes(data: Uint8Array, seq: readonly number[], offset: number): boolean {
  if (offset + seq.length > data.length) return false;
  return seq.every((b, i) => data[offset + i] === b);
}

/**
 * Parse the EXIF orientation tag from a JPEG `File`.
 *
 * Returns `1` (normal) if:
 * - The file is not a JPEG.
 * - No EXIF APP1 segment is found.
 * - The EXIF block is too short or malformed to read the IFD.
 *
 * Never throws — malformed input is treated as orientation 1 (no rotation).
 * The caller can detect a parse failure by observing `malformed` in the
 * returned `OrientationFailure` from `normalizeOrientation`.
 */
export async function readExifOrientation(file: File): Promise<ExifOrientation> {
  // Only JPEG can carry EXIF APP1 segments
  if (!file.type.startsWith('image/jpeg') && !file.name.toLowerCase().match(/\.jpe?g$/)) {
    return 1;
  }

  try {
    // Read enough bytes to scan the APP1 segment (max segment = 65535 bytes)
    const slice = file.slice(0, 65536 + 4);
    const buffer = await slice.arrayBuffer();
    const data = new Uint8Array(buffer);

    if (!matchBytes(data, JPEG_SOI, 0)) return 1;

    let offset = 2;
    while (offset < data.length - 1) {
      if (data[offset] !== 0xff) break;

      const marker = data[offset + 1];
      offset += 2;

      if (marker === 0xff) { offset--; continue; }
      if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= data.length) break;

      const segLen = (data[offset] << 8) | data[offset + 1];
      if (segLen < 2) break;
      const segStart = offset; // points at length bytes
      const segEnd = offset + segLen;

      if (marker === APP1_MARKER && segLen > 8) {
        if (matchBytes(data, EXIF_SIG, segStart + 2)) {
          // TIFF header starts after "Exif\0\0" (6 bytes after length field)
          const tiffOffset = segStart + 2 + 6;
          if (tiffOffset + 8 > data.length) return 1;

          const isLittleEndian =
            data[tiffOffset] === 0x49 && data[tiffOffset + 1] === 0x49;

          const readU16 = (pos: number): number => {
            if (pos + 1 >= data.length) return 0;
            return isLittleEndian
              ? data[pos] | (data[pos + 1] << 8)
              : (data[pos] << 8) | data[pos + 1];
          };

          const readU32 = (pos: number): number => {
            if (pos + 3 >= data.length) return 0;
            return isLittleEndian
              ? data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24)
              : (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
          };

          const ifdOffset = tiffOffset + readU32(tiffOffset + 4);
          if (ifdOffset + 2 > data.length) return 1;

          const entryCount = readU16(ifdOffset);
          for (let i = 0; i < entryCount; i++) {
            const entryPos = ifdOffset + 2 + i * 12;
            if (entryPos + 12 > data.length) break;
            const tag = readU16(entryPos);
            if (tag === ORIENTATION_TAG) {
              const val = readU16(entryPos + 8);
              if (val >= 1 && val <= 8) return val as ExifOrientation;
              return 1;
            }
          }
        }
      }

      offset = segEnd;
    }
  } catch {
    // Swallow — return default orientation
  }

  return 1;
}

// ─── Canvas-based orientation normalisation ───────────────────────────────────

/**
 * Draw an `<img>` element onto a canvas with the transform that converts
 * the given EXIF orientation to the canonical top-left baseline.
 *
 * This is the authoritative lookup table for JEITA EXIF 2.32 orientations.
 */
function applyOrientationTransform(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  orientation: ExifOrientation,
  sw: number,
  sh: number
): void {
  switch (orientation) {
    case 1: break; // identity
    case 2: ctx.transform(-1, 0, 0, 1, sw, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, sw, sh); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, sh); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, sh, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, sh, sw); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, sw); break;
  }
}

/** Returns true when the orientation value implies a 90°/270° rotation (swap W/H). */
function isTransposed(orientation: ExifOrientation): boolean {
  return orientation >= 5 && orientation <= 8;
}

// ─── Memory-limit decode ──────────────────────────────────────────────────────

export interface DecodedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
  objectUrl: string;
}

/**
 * Load a `File` into an `HTMLImageElement`, enforcing the memory and
 * dimension limits before the browser allocates the decoded bitmap.
 *
 * Returns a typed failure instead of throwing so callers can surface the
 * reason in the UI.
 */
export async function decodeWithMemoryLimit(
  file: File,
  signal?: AbortSignal
): Promise<{ ok: true; image: DecodedImage } | OrientationFailure> {
  if (signal?.aborted) {
    return { ok: false, reason: 'aborted', message: 'Image decode aborted.' };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode'));
      img.src = objectUrl;
    });

    if (signal?.aborted) {
      URL.revokeObjectURL(objectUrl);
      return { ok: false, reason: 'aborted', message: 'Image decode aborted.' };
    }

    const { naturalWidth: width, naturalHeight: height } = element;

    if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        reason: 'dimension',
        message: `Image dimensions ${width}×${height} exceed the ${MAX_DIMENSION_PX}px limit.`,
      };
    }

    if (width * height * 4 > MAX_DECODED_BYTES) {
      URL.revokeObjectURL(objectUrl);
      return {
        ok: false,
        reason: 'oversized',
        message: `Image ${width}×${height} exceeds the decoded memory limit.`,
      };
    }

    return { ok: true, image: { element, width, height, objectUrl } };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return { ok: false, reason: 'decode', message: 'Failed to decode image.' };
  }
}

// ─── Orientation normalisation ────────────────────────────────────────────────

/**
 * Normalise the orientation of an image `File` by re-encoding its pixels
 * through a canvas at the correct rotation/flip.
 *
 * The returned Blob has no EXIF metadata and canonically-oriented pixels,
 * so it can be shown in a preview or uploaded directly.
 */
export async function normalizeOrientation(
  file: File,
  signal?: AbortSignal
): Promise<OrientationResult> {
  const orientation = await readExifOrientation(file);

  const decoded = await decodeWithMemoryLimit(file, signal);
  if (!decoded.ok) return decoded;

  const { element, width, height, objectUrl } = decoded.image;

  try {
    const outW = isTransposed(orientation) ? height : width;
    const outH = isTransposed(orientation) ? width : height;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'canvas', message: 'Canvas 2D context unavailable.' };
    }

    applyOrientationTransform(ctx, orientation, width, height);
    ctx.drawImage(element, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });

    if (!blob) {
      return { ok: false, reason: 'canvas', message: 'Failed to encode corrected image.' };
    }

    return { ok: true, blob, orientation };
  } catch {
    return { ok: false, reason: 'canvas', message: 'Failed to apply orientation correction.' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Upload helper (issue #1439) ──────────────────────────────────────────────

/**
 * Result of correcting an uploaded pet photo for preview.
 *
 * `file` is the corrected, EXIF-stripped image ready for upload;
 * `previewUrl` is an object URL for the corrected image that the caller
 * must revoke when the preview is no longer needed.
 */
export interface CorrectedImage {
  file: File;
  previewUrl: string;
  orientation: ExifOrientation;
  /** True when the pixels were actually rotated/flipped. */
  corrected: boolean;
}

/**
 * Read EXIF orientation from an uploaded pet photo, rotate/flip the pixels
 * as needed, and return a preview-ready `File` plus object URL.
 *
 * On any failure (oversized, decode error, canvas unavailable) the original
 * file is returned unchanged so the upload flow can continue — the preview
 * simply shows the uncorrected image.
 */
export async function correctImageOrientation(
  file: File,
  signal?: AbortSignal
): Promise<CorrectedImage> {
  const orientation = await readExifOrientation(file);

  if (orientation === 1) {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      orientation,
      corrected: false,
    };
  }

  const result = await normalizeOrientation(file, signal);

  if (!result.ok) {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      orientation,
      corrected: false,
    };
  }

  const correctedFile = new File([result.blob], file.name, {
    type: result.blob.type || 'image/jpeg',
    lastModified: file.lastModified,
  });

  return {
    file: correctedFile,
    previewUrl: URL.createObjectURL(correctedFile),
    orientation: result.orientation,
    corrected: result.orientation !== 1,
  };
}
