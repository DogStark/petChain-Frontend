/**
 * attachmentValidation.test.ts
 *
 * Unit tests for all exported functions in attachmentValidation.ts.
 * Covers success, failure, and boundary cases for each rule.
 */
import type {
  ServerAttachmentParams} from './attachmentValidation';
import {
  isAllowedMimeType,
  isWithinSizeLimit,
  sanitizeFilename,
  validateAttachment,
  validateAttachmentServer,
  hasPdfMagicBytes,
  MAX_FILE_SIZE_BYTES,
  MAX_FILENAME_LENGTH
} from './attachmentValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

/** Valid PDF magic bytes: %PDF- */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const NOT_PDF_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG

function makeServerParams(overrides: Partial<ServerAttachmentParams> = {}): ServerAttachmentParams {
  return {
    declaredMimeType: 'application/pdf',
    magicBytes: PDF_MAGIC,
    sizeBytes: 1024,
    originalFilename: 'report.pdf',
    ...overrides,
  };
}

// ===========================================================================
// isAllowedMimeType
// ===========================================================================
describe('isAllowedMimeType', () => {
  it('accepts application/pdf', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('rejects image/png', () => {
    expect(isAllowedMimeType('image/png')).toBe(false);
  });

  it('rejects image/jpeg', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(false);
  });

  it('rejects application/octet-stream', () => {
    expect(isAllowedMimeType('application/octet-stream')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedMimeType('')).toBe(false);
  });

  it('is case-sensitive (APPLICATION/PDF is rejected)', () => {
    expect(isAllowedMimeType('APPLICATION/PDF')).toBe(false);
  });
});

// ===========================================================================
// isWithinSizeLimit
// ===========================================================================
describe('isWithinSizeLimit', () => {
  it('accepts 0 bytes', () => {
    expect(isWithinSizeLimit(0)).toBe(true);
  });

  it('accepts 1 MB', () => {
    expect(isWithinSizeLimit(1 * 1024 * 1024)).toBe(true);
  });

  it('accepts exactly the limit (10 MB)', () => {
    expect(isWithinSizeLimit(MAX_FILE_SIZE_BYTES)).toBe(true);
  });

  it('rejects one byte over the limit', () => {
    expect(isWithinSizeLimit(MAX_FILE_SIZE_BYTES + 1)).toBe(false);
  });

  it('rejects 11 MB', () => {
    expect(isWithinSizeLimit(11 * 1024 * 1024)).toBe(false);
  });
});

// ===========================================================================
// sanitizeFilename
// ===========================================================================
describe('sanitizeFilename', () => {
  it('returns a clean filename unchanged', () => {
    expect(sanitizeFilename('lab-report-2024.pdf')).toBe('lab-report-2024.pdf');
  });

  it('strips leading and trailing whitespace', () => {
    expect(sanitizeFilename('  report.pdf  ')).toBe('report.pdf');
  });

  it('rejects forward-slash path traversal', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBeNull();
  });

  it('rejects backslash path traversal', () => {
    expect(sanitizeFilename('..\\..\\Windows\\system32')).toBeNull();
  });

  it('rejects null byte in filename', () => {
    expect(sanitizeFilename('report\x00.pdf')).toBeNull();
  });

  it('rejects a filename with a <script> tag', () => {
    expect(sanitizeFilename('<script>alert(1)</script>.pdf')).toBeNull();
  });

  it('rejects a filename containing a double-quote', () => {
    expect(sanitizeFilename('re"port.pdf')).toBeNull();
  });

  it('rejects a filename containing a single-quote', () => {
    expect(sanitizeFilename("re'port.pdf")).toBeNull();
  });

  it('rejects a filename containing an ampersand', () => {
    expect(sanitizeFilename('re&port.pdf')).toBeNull();
  });

  it('rejects a filename exceeding MAX_FILENAME_LENGTH', () => {
    const longName = 'a'.repeat(MAX_FILENAME_LENGTH + 1) + '.pdf';
    expect(sanitizeFilename(longName)).toBeNull();
  });

  it('accepts a filename of exactly MAX_FILENAME_LENGTH characters', () => {
    const exactName = 'a'.repeat(MAX_FILENAME_LENGTH - 4) + '.pdf';
    // exactly MAX_FILENAME_LENGTH chars
    expect(exactName.length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH);
    expect(sanitizeFilename(exactName)).not.toBeNull();
  });

  it('rejects an empty string', () => {
    expect(sanitizeFilename('')).toBeNull();
  });

  it('rejects a string that becomes empty after stripping control chars', () => {
    expect(sanitizeFilename('\x01\x02\x03')).toBeNull();
  });

  it('strips control characters but keeps valid content', () => {
    const result = sanitizeFilename('re\x01port.pdf');
    expect(result).toBe('report.pdf');
  });

  it('accepts unicode letters in filenames', () => {
    expect(sanitizeFilename('résumé-rapport.pdf')).not.toBeNull();
  });
});

// ===========================================================================
// hasPdfMagicBytes
// ===========================================================================
describe('hasPdfMagicBytes', () => {
  it('returns true for valid PDF magic bytes', () => {
    expect(hasPdfMagicBytes(PDF_MAGIC)).toBe(true);
  });

  it('returns false for PNG magic bytes', () => {
    expect(hasPdfMagicBytes(NOT_PDF_MAGIC)).toBe(false);
  });

  it('returns false for an empty buffer', () => {
    expect(hasPdfMagicBytes(new Uint8Array([]))).toBe(false);
  });

  it('returns false for a buffer shorter than the magic sequence', () => {
    expect(hasPdfMagicBytes(new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it('returns false when first byte differs', () => {
    const bad = new Uint8Array(PDF_MAGIC);
    bad[0] = 0x00;
    expect(hasPdfMagicBytes(bad)).toBe(false);
  });
});

// ===========================================================================
// validateAttachment (client-side composite)
// ===========================================================================
describe('validateAttachment', () => {
  it('returns valid for a good PDF under the size limit', () => {
    const file = makeFile('report.pdf', 1024, 'application/pdf');
    expect(validateAttachment(file)).toEqual({ valid: true });
  });

  it('returns invalid for an image/png file', () => {
    const file = makeFile('photo.png', 1024, 'image/png');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pdf/i);
  });

  it('returns invalid for an oversized PDF', () => {
    const file = makeFile('big.pdf', MAX_FILE_SIZE_BYTES + 1, 'application/pdf');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/10\s*mb|too large|size/i);
  });

  it('returns valid for a PDF that is exactly the size limit', () => {
    const file = makeFile('exact.pdf', MAX_FILE_SIZE_BYTES, 'application/pdf');
    expect(validateAttachment(file)).toEqual({ valid: true });
  });

  it('returns invalid for a path-traversal filename', () => {
    const file = makeFile('../../../etc/passwd', 1024, 'application/pdf');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/filename|invalid/i);
  });

  it('returns invalid for an excessively long filename', () => {
    const file = makeFile('a'.repeat(256) + '.pdf', 1024, 'application/pdf');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for a filename with HTML injection', () => {
    const file = makeFile('<script>x</script>.pdf', 1024, 'application/pdf');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for an empty MIME type', () => {
    const file = makeFile('report.pdf', 1024, '');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
  });

  it('MIME check fires before size check', () => {
    // Wrong type AND oversized – error should mention type, not size
    const file = makeFile('photo.png', MAX_FILE_SIZE_BYTES + 1, 'image/png');
    const result = validateAttachment(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pdf/i);
  });
});

// ===========================================================================
// validateAttachmentServer (server-side composite)
// ===========================================================================
describe('validateAttachmentServer', () => {
  const cleanScan = async () => null;
  const threatScan = async () => 'Trojan.Generic detected';

  it('returns valid for a well-formed PDF request', async () => {
    const result = await validateAttachmentServer(makeServerParams(), cleanScan);
    expect(result).toEqual({ valid: true });
  });

  it('rejects a disallowed MIME type', async () => {
    const result = await validateAttachmentServer(
      makeServerParams({ declaredMimeType: 'image/png' }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pdf/i);
  });

  it('rejects when magic bytes do not match PDF', async () => {
    const result = await validateAttachmentServer(
      makeServerParams({ magicBytes: NOT_PDF_MAGIC }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/content|type|pdf/i);
  });

  it('rejects an oversized file', async () => {
    const result = await validateAttachmentServer(
      makeServerParams({ sizeBytes: MAX_FILE_SIZE_BYTES + 1 }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/10\s*mb|size/i);
  });

  it('accepts a file of exactly the size limit', async () => {
    const result = await validateAttachmentServer(
      makeServerParams({ sizeBytes: MAX_FILE_SIZE_BYTES }),
      cleanScan,
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects a path-traversal filename', async () => {
    const result = await validateAttachmentServer(
      makeServerParams({ originalFilename: '../../../etc/passwd' }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/filename/i);
  });

  it('rejects when the malware scan returns a threat', async () => {
    const result = await validateAttachmentServer(makeServerParams(), threatScan);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Trojan/i);
  });

  it('uses the no-op scanner by default (no scan argument)', async () => {
    const result = await validateAttachmentServer(makeServerParams());
    expect(result).toEqual({ valid: true });
  });

  it('MIME check fires before magic-byte check', async () => {
    // Wrong MIME AND wrong magic – error should mention type
    const result = await validateAttachmentServer(
      makeServerParams({ declaredMimeType: 'image/png', magicBytes: NOT_PDF_MAGIC }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/pdf/i);
  });

  it('magic-byte check fires before size check', async () => {
    // Wrong magic AND oversized – error should mention content/type
    const result = await validateAttachmentServer(
      makeServerParams({
        magicBytes: NOT_PDF_MAGIC,
        sizeBytes: MAX_FILE_SIZE_BYTES + 1,
      }),
      cleanScan,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/content|type|pdf/i);
  });
});
