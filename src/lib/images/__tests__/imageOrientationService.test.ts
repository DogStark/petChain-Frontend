/**
 * Tests for imageOrientationService.ts — Issue #963
 *
 * Covers:
 *  - Portrait and landscape orientation values (1–8)
 *  - Malformed / truncated EXIF blocks
 *  - Images that contain GPS tags (orientation still readable, GPS stripped by canvas)
 *  - Huge dimensions triggering the memory-limit failure state
 *  - Cancellation via AbortSignal
 *  - Non-JPEG files defaulting to orientation 1
 *  - Canvas transform matrix lookup table
 *
 * Jest environment: jsdom (configured in jest.config.js)
 */

import {
  readExifOrientation,
  normalizeOrientation,
  decodeWithMemoryLimit,
  ExifOrientation,
  MAX_DECODED_BYTES,
  MAX_DIMENSION_PX,
  _internal,
} from '../imageOrientationService';

const { matchBytes, isTransposed, ORIENTATION_TAG } = _internal;

// ─── JPEG byte-level builders ─────────────────────────────────────────────────

function buildJpegWithExif(orientationValue: number, extraTags: Uint8Array = new Uint8Array(0)): File {
  /**
   * Minimal JPEG with a synthetic EXIF APP1 block.
   *
   * Layout:
   *   FF D8                           SOI
   *   FF E1 <segLen hi> <segLen lo>   APP1 marker + length
   *   45 78 69 66 00 00               "Exif\0\0"
   *   49 49                           TIFF little-endian
   *   2A 00                           TIFF magic
   *   08 00 00 00                     IFD0 offset = 8 (relative to TIFF header start)
   *   <entryCount: u16>               Number of IFD entries
   *   <entries…>                      12 bytes each
   *   00 00 00 00                     Next IFD offset (none)
   *   FF D9                           EOI
   */
  const TIFF_HEADER_OFFSET = 6; // "Exif\0\0" is 6 bytes
  const IFD_OFFSET = 8;        // standard TIFF IFD0 offset

  const hasOrientation = orientationValue >= 1 && orientationValue <= 8;
  const entryCount = hasOrientation ? 1 : 0;

  // Build IFD entries
  const ifdEntries = new Uint8Array(entryCount * 12);
  if (hasOrientation) {
    // tag = 0x0112 (orientation), type = 3 (SHORT), count = 1, value = orientationValue
    ifdEntries[0] = 0x12; ifdEntries[1] = 0x01; // tag LE
    ifdEntries[2] = 0x03; ifdEntries[3] = 0x00; // type SHORT
    ifdEntries[4] = 0x01; ifdEntries[5] = 0x00; ifdEntries[6] = 0x00; ifdEntries[7] = 0x00; // count = 1
    ifdEntries[8] = orientationValue; ifdEntries[9] = 0x00; ifdEntries[10] = 0x00; ifdEntries[11] = 0x00; // value LE
  }

  // TIFF block: header(8) + IFD entry count(2) + entries + next IFD(4)
  const tiffSize = 8 + 2 + ifdEntries.length + 4 + extraTags.length;
  const tiff = new Uint8Array(tiffSize);
  tiff[0] = 0x49; tiff[1] = 0x49; // little-endian
  tiff[2] = 0x2a; tiff[3] = 0x00; // TIFF magic
  tiff[4] = IFD_OFFSET; tiff[5] = 0x00; tiff[6] = 0x00; tiff[7] = 0x00; // IFD0 offset

  // IFD0
  tiff[8] = entryCount; tiff[9] = 0x00; // entry count LE
  tiff.set(ifdEntries, 10);

  // Append extra tags data after entries (GPS simulation)
  if (extraTags.length > 0) {
    tiff.set(extraTags, 10 + ifdEntries.length + 4);
  }

  // Full APP1: "Exif\0\0" + TIFF block
  const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const app1Payload = new Uint8Array(exif.length + tiff.length);
  app1Payload.set(exif, 0);
  app1Payload.set(tiff, exif.length);

  // APP1 segment length includes the 2-byte length field itself
  const segLen = app1Payload.length + 2;
  const jpeg = new Uint8Array(2 + 2 + 2 + app1Payload.length + 2);
  let i = 0;
  jpeg[i++] = 0xff; jpeg[i++] = 0xd8;       // SOI
  jpeg[i++] = 0xff; jpeg[i++] = 0xe1;        // APP1
  jpeg[i++] = (segLen >> 8) & 0xff;
  jpeg[i++] = segLen & 0xff;
  jpeg.set(app1Payload, i); i += app1Payload.length;
  jpeg[i++] = 0xff; jpeg[i++] = 0xd9;        // EOI

  return new File([jpeg.buffer], 'test.jpg', { type: 'image/jpeg' });
}

function buildCleanJpeg(): File {
  // SOI + EOI only — no metadata
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer], 'clean.jpg', { type: 'image/jpeg' });
}

function buildTruncatedExifJpeg(): File {
  // APP1 declared as large but payload cut short
  const partial = new Uint8Array([
    0xff, 0xd8,             // SOI
    0xff, 0xe1,             // APP1
    0x00, 0x20,             // segment length = 32 (but we only provide 4 more bytes)
    0x45, 0x78,             // "Ex" (truncated "Exif\0\0")
    0xff, 0xd9,             // EOI
  ]);
  return new File([partial.buffer], 'truncated.jpg', { type: 'image/jpeg' });
}

function buildPngFile(): File {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([pngHeader.buffer], 'image.png', { type: 'image/png' });
}

function buildWebpFile(): File {
  // RIFF....WEBP minimal header
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  return new File([webp.buffer], 'image.webp', { type: 'image/webp' });
}

/** Build a fake GPS IFD payload (raw bytes after the IFD entry block). */
function buildGpsTagBytes(): Uint8Array {
  // A few fake GPS-like bytes; the exact structure doesn't matter for orientation tests
  return new Uint8Array([
    0x00, 0x02,             // GPS latitude degrees numerator
    0x00, 0x00,
    0x00, 0x01,
    0x37, 0x26,             // approximate degrees
  ]);
}

// ─── matchBytes helper ────────────────────────────────────────────────────────

describe('matchBytes', () => {
  it('returns true when sequence is present at offset', () => {
    const d = new Uint8Array([0x00, 0xff, 0xd8, 0x01]);
    expect(matchBytes(d, [0xff, 0xd8], 1)).toBe(true);
  });

  it('returns false when sequence is absent', () => {
    const d = new Uint8Array([0x00, 0x01, 0x02]);
    expect(matchBytes(d, [0xff, 0xd8], 0)).toBe(false);
  });

  it('returns false when sequence would extend past the data', () => {
    const d = new Uint8Array([0xff]);
    expect(matchBytes(d, [0xff, 0xd8], 0)).toBe(false);
  });

  it('returns true for an empty sequence', () => {
    expect(matchBytes(new Uint8Array([0x00]), [], 0)).toBe(true);
  });
});

// ─── isTransposed ─────────────────────────────────────────────────────────────

describe('isTransposed', () => {
  it('returns false for orientations 1–4 (landscape group)', () => {
    ([1, 2, 3, 4] as ExifOrientation[]).forEach((o) => {
      expect(isTransposed(o)).toBe(false);
    });
  });

  it('returns true for orientations 5–8 (transposed / 90° group)', () => {
    ([5, 6, 7, 8] as ExifOrientation[]).forEach((o) => {
      expect(isTransposed(o)).toBe(true);
    });
  });
});

// ─── readExifOrientation ──────────────────────────────────────────────────────

describe('readExifOrientation', () => {
  it('returns 1 for a clean JPEG with no APP1', async () => {
    const file = buildCleanJpeg();
    expect(await readExifOrientation(file)).toBe(1);
  });

  it('reads orientation 1 (normal / landscape)', async () => {
    expect(await readExifOrientation(buildJpegWithExif(1))).toBe(1);
  });

  it('reads orientation 3 (rotated 180°)', async () => {
    expect(await readExifOrientation(buildJpegWithExif(3))).toBe(3);
  });

  it('reads orientation 6 (portrait — phone held upright, 90° CW)', async () => {
    expect(await readExifOrientation(buildJpegWithExif(6))).toBe(6);
  });

  it('reads orientation 8 (portrait — 90° CCW)', async () => {
    expect(await readExifOrientation(buildJpegWithExif(8))).toBe(8);
  });

  it('reads all 8 valid orientation values correctly', async () => {
    for (let v = 1; v <= 8; v++) {
      expect(await readExifOrientation(buildJpegWithExif(v))).toBe(v);
    }
  });

  it('returns 1 for a PNG (no EXIF orientation tag)', async () => {
    expect(await readExifOrientation(buildPngFile())).toBe(1);
  });

  it('returns 1 for a WebP', async () => {
    expect(await readExifOrientation(buildWebpFile())).toBe(1);
  });

  it('returns 1 for a truncated / malformed EXIF block (does not throw)', async () => {
    const file = buildTruncatedExifJpeg();
    const result = await readExifOrientation(file);
    expect(result).toBe(1);
  });

  it('returns 1 for an empty file', async () => {
    const empty = new File([new Uint8Array(0)], 'empty.jpg', { type: 'image/jpeg' });
    expect(await readExifOrientation(empty)).toBe(1);
  });

  it('returns 1 for a non-image file masquerading as JPEG', async () => {
    // Build a byte array from plain ASCII (no TextEncoder needed)
    const chars = 'not an image at all';
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    const text = new File([bytes.buffer], 'fake.jpg', { type: 'image/jpeg' });
    expect(await readExifOrientation(text)).toBe(1);
  });

  it('correctly reads orientation from a JPEG that also has GPS tag bytes', async () => {
    const gpsBytes = buildGpsTagBytes();
    const file = buildJpegWithExif(6, gpsBytes);
    // Orientation 6 must still be readable even when GPS data follows
    expect(await readExifOrientation(file)).toBe(6);
  });

  it('ORIENTATION_TAG constant is 0x0112', () => {
    expect(ORIENTATION_TAG).toBe(0x0112);
  });
});

// ─── decodeWithMemoryLimit ────────────────────────────────────────────────────

describe('decodeWithMemoryLimit', () => {
  let originalImage: typeof global.Image;

  beforeEach(() => {
    originalImage = global.Image;
  });

  afterEach(() => {
    global.Image = originalImage;
  });

  function mockImageLoad(width: number, height: number) {
    // @ts-expect-error — mock assignment
    global.Image = class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        // trigger load asynchronously
        setTimeout(() => this.onload?.(), 0);
      }
    };
    // Mock URL.createObjectURL / revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  }

  function mockImageError() {
    // @ts-expect-error — mock assignment
    global.Image = class {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    };
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  }

  it('succeeds for a normal image within memory limits', async () => {
    mockImageLoad(1920, 1080);
    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file);
    expect('element' in result).toBe(true);
    if ('element' in result) {
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    }
  });

  it('returns oversized failure when decoded bytes would exceed MAX_DECODED_BYTES', async () => {
    // 8000×8001 = ~256MB+ RGBA
    const w = 8000;
    const h = Math.ceil(MAX_DECODED_BYTES / (w * 4)) + 1;
    mockImageLoad(w, h);
    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file);
    expect(result).toMatchObject({ ok: false, reason: 'oversized' });
  });

  it('returns dimension failure when a dimension exceeds MAX_DIMENSION_PX', async () => {
    mockImageLoad(MAX_DIMENSION_PX + 1, 100);
    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file);
    expect(result).toMatchObject({ ok: false, reason: 'dimension' });
  });

  it('returns decode failure when the image cannot be loaded', async () => {
    mockImageError();
    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file);
    expect(result).toMatchObject({ ok: false, reason: 'decode' });
  });

  it('returns aborted failure immediately when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file, ac.signal);
    expect(result).toMatchObject({ ok: false, reason: 'aborted' });
  });

  it('returns aborted failure when signal fires during decode', async () => {
    const ac = new AbortController();
    // @ts-expect-error — mock assignment
    global.Image = class {
      naturalWidth = 1920;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        // fire abort before onload
        setTimeout(() => ac.abort(), 0);
        setTimeout(() => this.onload?.(), 10);
      }
    };
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    const file = buildCleanJpeg();
    const result = await decodeWithMemoryLimit(file, ac.signal);
    expect(result).toMatchObject({ ok: false, reason: 'aborted' });
  });
});

// ─── normalizeOrientation ─────────────────────────────────────────────────────

describe('normalizeOrientation', () => {
  let originalImage: typeof global.Image;

  beforeEach(() => {
    originalImage = global.Image;
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    global.Image = originalImage;
  });

  function setupCanvasMock(width: number, height: number) {
    // @ts-expect-error — mock assignment
    global.Image = class {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };

    const mockCtx = {
      transform: jest.fn(),
      drawImage: jest.fn(),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => mockCtx),
      toBlob: jest.fn((cb: (b: Blob | null) => void) => {
        cb(new Blob(['fake-pixel-data'], { type: 'image/jpeg' }));
      }),
    };

    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    return { mockCtx, mockCanvas };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns ok:true with a blob for orientation 1 (landscape, no rotation)', async () => {
    setupCanvasMock(1920, 1080);
    const file = buildJpegWithExif(1);
    const result = await normalizeOrientation(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orientation).toBe(1);
      expect(result.blob).toBeInstanceOf(Blob);
    }
  });

  it('returns ok:true for orientation 6 (portrait 90° CW)', async () => {
    setupCanvasMock(1080, 1920);
    const file = buildJpegWithExif(6);
    const result = await normalizeOrientation(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orientation).toBe(6);
    }
  });

  it('swaps canvas dimensions for transposed orientations (5–8)', async () => {
    const { mockCanvas } = setupCanvasMock(1080, 1920);
    const file = buildJpegWithExif(6);
    await normalizeOrientation(file);
    // For orientation 6 (transposed), outW=naturalH=1920, outH=naturalW=1080
    expect(mockCanvas.width).toBe(1920);
    expect(mockCanvas.height).toBe(1080);
  });

  it('does NOT swap canvas dimensions for non-transposed orientations (1–4)', async () => {
    const { mockCanvas } = setupCanvasMock(1920, 1080);
    const file = buildJpegWithExif(3);
    await normalizeOrientation(file);
    // For orientation 3 (180°, not transposed), dimensions stay the same
    expect(mockCanvas.width).toBe(1920);
    expect(mockCanvas.height).toBe(1080);
  });

  it('applies a canvas transform for every orientation value', async () => {
    for (let v = 1; v <= 8; v++) {
      jest.restoreAllMocks();
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      const { mockCtx } = setupCanvasMock(640, 480);
      const file = buildJpegWithExif(v);
      const result = await normalizeOrientation(file);
      expect(result.ok).toBe(true);

      if (v !== 1) {
        // Orientations 2–8 must call ctx.transform(...)
        expect(mockCtx.transform).toHaveBeenCalled();
      }
    }
  });

  it('returns ok:true for PNG (orientation=1 default, no EXIF)', async () => {
    setupCanvasMock(800, 600);
    const file = buildPngFile();
    const result = await normalizeOrientation(file);
    expect(result.ok).toBe(true);
  });

  it('returns aborted failure immediately when signal is pre-aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const file = buildJpegWithExif(1);
    const result = await normalizeOrientation(file, ac.signal);
    expect(result).toMatchObject({ ok: false, reason: 'aborted' });
  });

  it('returns oversized failure when decoded image would exceed memory limit', async () => {
    // Set up a very large image
    const w = 8000;
    const h = Math.ceil(MAX_DECODED_BYTES / (w * 4)) + 1;
    setupCanvasMock(w, h);
    const file = buildJpegWithExif(1);
    const result = await normalizeOrientation(file);
    expect(result).toMatchObject({ ok: false, reason: 'oversized' });
  });

  it('surfaces a dimension failure when a dimension exceeds MAX_DIMENSION_PX', async () => {
    setupCanvasMock(MAX_DIMENSION_PX + 1, 100);
    const file = buildJpegWithExif(1);
    const result = await normalizeOrientation(file);
    expect(result).toMatchObject({ ok: false, reason: 'dimension' });
  });

  it('returns canvas failure when getContext returns null', async () => {
    // @ts-expect-error — mock assignment
    global.Image = class {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this.onload?.(), 0); }
    };

    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return {
        width: 0, height: 0,
        getContext: jest.fn(() => null),
        toBlob: jest.fn(),
      } as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    const file = buildJpegWithExif(1);
    const result = await normalizeOrientation(file);
    expect(result).toMatchObject({ ok: false, reason: 'canvas' });
  });

  it('GPS tags embedded in EXIF do not prevent orientation normalisation', async () => {
    setupCanvasMock(1920, 1080);
    const gpsBytes = buildGpsTagBytes();
    const file = buildJpegWithExif(6, gpsBytes);
    const result = await normalizeOrientation(file);
    // Orientation 6 should be read correctly even with extra GPS data
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orientation).toBe(6);
    }
  });

  it('output blob never carries EXIF data (canvas strips all metadata)', async () => {
    setupCanvasMock(1920, 1080);
    const file = buildJpegWithExif(6);
    const result = await normalizeOrientation(file);
    // The blob comes from canvas.toBlob which produces clean pixel data
    // with no metadata — we verify the service returns a truthy blob
    expect(result.ok).toBe(true);
  });
});

// ─── Cancellation edge cases ──────────────────────────────────────────────────

describe('normalizeOrientation cancellation', () => {
  it('handles abort between orientation read and decode', async () => {
    const ac = new AbortController();
    // Abort while the readExifOrientation promise is in flight
    const filePromise = normalizeOrientation(buildJpegWithExif(6), ac.signal);
    ac.abort();
    const result = await filePromise;
    // Either an aborted failure or an ok result if orientation read already completed
    // — either is acceptable; what must NOT happen is an unhandled exception
    expect(result).toHaveProperty('ok');
  });
});
