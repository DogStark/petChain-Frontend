/**
 * @file exifUtils.ts
 * Utilities for verifying that EXIF / XMP / IPTC metadata has been stripped
 * from image files before they are uploaded.
 *
 * ## Why metadata matters
 * JPEG and other image formats embed rich metadata headers (EXIF, XMP, IPTC).
 * GPS coordinates, device model, and owner information in these headers can
 * expose an owner's location and identity — a privacy risk described in #878.
 *
 * ## How metadata is stripped
 * `browser-image-compression` is called with `preserveExif: false`.  The
 * library re-encodes the image through a <canvas>, which produces a fresh
 * pixel buffer with no metadata markers.
 *
 * ## JPEG orientation handling
 * EXIF orientation (tag 0x0112) tells viewers how to rotate/flip the image
 * for correct display.  When `preserveExif: false` is used the orientation tag
 * is discarded along with all other metadata.  To prevent rotated images,
 * `browser-image-compression` applies the orientation transform to the pixel
 * data itself before encoding — the visual appearance is preserved even though
 * the tag is gone.  No additional rotation logic is required on the frontend.
 */

/**
 * JPEG SOI (Start Of Image) marker — every valid JPEG begins with FF D8.
 */
const JPEG_SOI_MARKER = [0xff, 0xd8] as const;

/**
 * EXIF segment signature embedded in an APP1 (0xFF 0xE1) segment.
 * The six bytes spell "Exif\0\0".
 */
const EXIF_SIGNATURE = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const;

/**
 * XMP segment signature embedded in an APP1 segment.
 * The segment data begins with the null-terminated namespace URI:
 * "http://ns.adobe.com/xap/1.0/\0"
 */
const XMP_SIGNATURE = 'http://ns.adobe.com/xap/1.0/\0';

/**
 * Return the first N bytes of a File or Blob as a Uint8Array.
 * @internal kept for potential future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function readBytes(file: Blob, length: number): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Read the entire file as a Uint8Array.
 */
async function readAllBytes(file: Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Check whether a Uint8Array contains a sequence of bytes starting at a given
 * offset.
 */
function containsBytes(data: Uint8Array, sequence: readonly number[], offset = 0): boolean {
  if (offset + sequence.length > data.length) return false;
  return sequence.every((byte, i) => data[offset + i] === byte);
}

/**
 * Scan a JPEG byte array for APP1 segments and detect the presence of
 * EXIF data (identified by the "Exif\0\0" signature).
 *
 * @returns `true` if any EXIF APP1 segment was found; otherwise `false`.
 */
function hasExifSegment(data: Uint8Array): boolean {
  // Must be a JPEG
  if (!containsBytes(data, JPEG_SOI_MARKER)) return false;

  let offset = 2; // skip SOI
  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) break; // not a valid marker

    const marker = data[offset + 1];
    offset += 2;

    // Skip padding bytes
    if (marker === 0xff) {
      offset--;
      continue;
    }

    // EOI or stand-alone markers have no length
    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    if (offset + 1 >= data.length) break;
    const segLength = (data[offset] << 8) | data[offset + 1];
    if (segLength < 2) break;

    const segEnd = offset + segLength;

    // APP1 marker = 0xE1
    if (marker === 0xe1 && segLength > 8) {
      // Check for EXIF signature at offset+2 (after the 2-byte length field)
      if (containsBytes(data, EXIF_SIGNATURE, offset + 2)) {
        return true;
      }
    }

    offset = segEnd;
  }

  return false;
}

/**
 * Scan a JPEG byte array for XMP metadata embedded as an APP1 segment
 * with the Adobe XMP namespace URI.
 *
 * @returns `true` if an XMP APP1 segment was found; otherwise `false`.
 */
function hasXmpSegment(data: Uint8Array): boolean {
  if (!containsBytes(data, JPEG_SOI_MARKER)) return false;

  const xmpSigBytes = Array.from(XMP_SIGNATURE).map((c) => c.charCodeAt(0));
  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) break;

    const marker = data[offset + 1];
    offset += 2;

    if (marker === 0xff) { offset--; continue; }
    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) break;

    const segLength = (data[offset] << 8) | data[offset + 1];
    if (segLength < 2) break;

    if (marker === 0xe1 && segLength > xmpSigBytes.length + 2) {
      if (containsBytes(data, xmpSigBytes, offset + 2)) {
        return true;
      }
    }

    offset += segLength;
  }

  return false;
}

export interface MetadataCheckResult {
  /** `true` when the file passes the metadata-free check. */
  clean: boolean;
  /** Detected EXIF segment? */
  hasExif: boolean;
  /** Detected XMP segment? */
  hasXmp: boolean;
  /** Compressed file size in bytes. */
  byteSize: number;
}

/**
 * Verify that a compressed image file contains no detectable EXIF or XMP
 * metadata segments.
 *
 * This is an in-browser defence-in-depth check that runs after
 * `browser-image-compression` has processed the file.  Because the library
 * already strips metadata during canvas re-encoding, this function should
 * always return `{ clean: true }` for compressed output.  If it does not,
 * the upload is blocked and an error is surfaced to the caller.
 *
 * **Note:** the check only covers JPEG APP1 segments.  PNG and WebP metadata
 * is not scanned here because:
 * - PNG tEXt / iTXt / zTXt chunks do not embed GPS coordinates.
 * - WebP is always re-encoded through canvas (no metadata pass-through).
 *
 * @param file  The compressed `File` object to inspect.
 * @returns     A {@link MetadataCheckResult} describing what was found.
 */
export async function verifyMetadataStripped(file: File): Promise<MetadataCheckResult> {
  const byteSize = file.size;

  // Only JPEG files embed EXIF / XMP in well-known segment positions
  if (file.type !== 'image/jpeg' && !file.name.toLowerCase().match(/\.jpe?g$/)) {
    return { clean: true, hasExif: false, hasXmp: false, byteSize };
  }

  const data = await readAllBytes(file);
  const hasExif = hasExifSegment(data);
  const hasXmp = hasXmpSegment(data);

  return {
    clean: !hasExif && !hasXmp,
    hasExif,
    hasXmp,
    byteSize,
  };
}

/**
 * Exported for unit testing only.
 * @internal
 */
export const _internal = {
  hasExifSegment,
  hasXmpSegment,
  containsBytes,
  EXIF_SIGNATURE,
  JPEG_SOI_MARKER,
};
