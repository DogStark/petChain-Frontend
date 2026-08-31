/**
 * Regression tests for issue #878:
 * Strip pet-photo metadata before upload.
 *
 * These tests exercise the pure JPEG-scanning logic from exifUtils.ts
 * without requiring a browser environment.
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/petPhotoMetadata.test.ts
 */

import { _internal } from '../src/components/PetPhotos/exifUtils';

const { hasExifSegment, hasXmpSegment, containsBytes, EXIF_SIGNATURE, JPEG_SOI_MARKER } = _internal;

// ─── test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>)
        .then(() => { console.log(`  ✓ ${description}`); passed++; })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ✗ ${description}\n    ${msg}`);
          failed++;
        });
    } else {
      console.log(`  ✓ ${description}`);
      passed++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${description}\n    ${msg}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
  };
}

// ─── JPEG byte-level helpers ─────────────────────────────────────────────────

/**
 * Build a minimal synthetic JPEG byte array containing a specific APP1
 * segment payload.
 *
 * Structure:
 *   FF D8           SOI
 *   FF E1           APP1 marker
 *   <len hi> <len lo>  segment length (includes length bytes, excludes marker)
 *   <payload bytes>    segment data
 *   FF D9           EOI
 */
function buildJpeg(app1Payload: Uint8Array): Uint8Array {
  const segLen = app1Payload.length + 2; // length field includes itself
  const buf = new Uint8Array(2 + 2 + 2 + app1Payload.length + 2);
  let i = 0;
  buf[i++] = 0xff; buf[i++] = 0xd8; // SOI
  buf[i++] = 0xff; buf[i++] = 0xe1; // APP1
  buf[i++] = (segLen >> 8) & 0xff;
  buf[i++] = segLen & 0xff;
  buf.set(app1Payload, i);
  i += app1Payload.length;
  buf[i++] = 0xff; buf[i++] = 0xd9; // EOI
  return buf;
}

/**
 * Build a minimal JPEG with no metadata APP1 segments (clean output from
 * canvas re-encoding).
 */
function buildCleanJpeg(): Uint8Array {
  // SOI + EOI only
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

/**
 * Build a JPEG APP1 payload that starts with "Exif\0\0".
 */
function makeExifPayload(): Uint8Array {
  const sig = new Uint8Array(EXIF_SIGNATURE);
  const data = new Uint8Array(sig.length + 4); // some dummy TIFF bytes
  data.set(sig, 0);
  data[sig.length] = 0x49; // 'I' (Intel byte order)
  data[sig.length + 1] = 0x49;
  data[sig.length + 2] = 0x2a;
  data[sig.length + 3] = 0x00;
  return data;
}

/**
 * Build a JPEG APP1 payload that starts with the XMP namespace URI.
 */
function makeXmpPayload(): Uint8Array {
  const uri = 'http://ns.adobe.com/xap/1.0/\0';
  const uriBytes = Array.from(uri).map((c) => c.charCodeAt(0));
  const payload = new Uint8Array(uriBytes.length + 20);
  uriBytes.forEach((b, idx) => { payload[idx] = b; });
  return payload;
}

// ─── tests ───────────────────────────────────────────────────────────────────

console.log('\n[#878] Pet photo metadata stripping\n');

// containsBytes helper
test('containsBytes returns true when sequence is present at offset', () => {
  const data = new Uint8Array([0x00, 0xff, 0xd8, 0xfe]);
  expect(containsBytes(data, [0xff, 0xd8], 1)).toBeTruthy();
});

test('containsBytes returns false when sequence is absent', () => {
  const data = new Uint8Array([0x00, 0x01, 0x02]);
  expect(containsBytes(data, [0xff, 0xd8], 0)).toBeFalsy();
});

test('containsBytes returns false when sequence extends past data', () => {
  const data = new Uint8Array([0xff]);
  expect(containsBytes(data, [0xff, 0xd8], 0)).toBeFalsy();
});

// hasExifSegment
test('hasExifSegment returns true for a JPEG with Exif APP1 segment', () => {
  const jpeg = buildJpeg(makeExifPayload());
  expect(hasExifSegment(jpeg)).toBeTruthy();
});

test('hasExifSegment returns false for a clean JPEG (no metadata)', () => {
  const jpeg = buildCleanJpeg();
  expect(hasExifSegment(jpeg)).toBeFalsy();
});

test('hasExifSegment returns false for non-JPEG data', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  expect(hasExifSegment(png)).toBeFalsy();
});

test('hasExifSegment returns false for empty array', () => {
  expect(hasExifSegment(new Uint8Array([]))).toBeFalsy();
});

// hasXmpSegment
test('hasXmpSegment returns true for a JPEG with XMP APP1 segment', () => {
  const jpeg = buildJpeg(makeXmpPayload());
  expect(hasXmpSegment(jpeg)).toBeTruthy();
});

test('hasXmpSegment returns false for a clean JPEG (no metadata)', () => {
  const jpeg = buildCleanJpeg();
  expect(hasXmpSegment(jpeg)).toBeFalsy();
});

test('hasXmpSegment returns false for non-JPEG data', () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
  expect(hasXmpSegment(webp)).toBeFalsy();
});

// Orientation handling documentation test (logic verification)
test('EXIF signature constant matches 6-byte Exif\\0\\0 marker', () => {
  // Widen const tuple to a plain number[] before comparing
  const sig: number[] = [...EXIF_SIGNATURE];
  expect(sig.length).toBe(6);
  // E=0x45, x=0x78, i=0x69, f=0x66, NUL, NUL
  expect(JSON.stringify(sig)).toBe(JSON.stringify([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]));
});

test('JPEG SOI marker constant is FF D8', () => {
  const soi: number[] = [...JPEG_SOI_MARKER];
  expect(soi[0]).toBe(0xff);
  expect(soi[1]).toBe(0xd8);
});

// ─── summary ─────────────────────────────────────────────────────────────────

// Give async tests a tick to settle
setTimeout(() => {
  console.log(`\n  Passed: ${passed}  Failed: ${failed}\n`);
  if (failed > 0) {
    process.exit(1);
  }
}, 100);
