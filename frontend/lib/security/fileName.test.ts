import {
  sanitizeDisplayName,
  sanitizeStorageId,
  buildContentDisposition,
  sanitizeFileName,
} from './fileName';

describe('sanitizeDisplayName', () => {
  it('preserves ordinary Unicode names', () => {
    expect(sanitizeDisplayName('Röntgen 报告.pdf')).toBe('Röntgen 报告.pdf');
  });

  it('strips bidi control characters', () => {
    const name = 'report\u202Egnp.exe';
    const result = sanitizeDisplayName(name);
    expect(result).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(result).toBe('reportgnp.exe');
  });

  it('removes path traversal sequences', () => {
    expect(sanitizeDisplayName('../../etc/passwd')).not.toContain('..');
    expect(sanitizeDisplayName('..\\..\\windows\\system32')).not.toContain('..');
  });

  it('removes control characters', () => {
    expect(sanitizeDisplayName('scan\u0000\u0007.pdf')).toBe('scan.pdf');
  });

  it('truncates excessively long names', () => {
    const long = 'a'.repeat(500) + '.pdf';
    const result = sanitizeDisplayName(long);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('handles empty and whitespace-only input', () => {
    expect(sanitizeDisplayName('')).toBe('');
    expect(sanitizeDisplayName('   ')).toBe('');
  });
});

describe('sanitizeStorageId', () => {
  it('produces a stable identifier independent of display name', () => {
    const id = sanitizeStorageId('Röntgen 报告.pdf');
    expect(id).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(id).not.toContain(' ');
  });

  it('rejects path traversal in storage identifiers', () => {
    const id = sanitizeStorageId('../../etc/passwd');
    expect(id).not.toContain('..');
    expect(id).not.toContain('/');
  });

  it('deduplicates identical names with a suffix', () => {
    const first = sanitizeStorageId('scan.pdf');
    const second = sanitizeStorageId('scan.pdf', [first]);
    expect(second).not.toBe(first);
    expect(second).toMatch(/^scan.*\.pdf$/);
  });

  it('truncates long identifiers while keeping extension', () => {
    const id = sanitizeStorageId('a'.repeat(500) + '.pdf');
    expect(id.length).toBeLessThanOrEqual(255);
    expect(id.endsWith('.pdf')).toBe(true);
  });
});

describe('buildContentDisposition', () => {
  it('uses a safe ASCII fallback and RFC 5987 filename*', () => {
    const header = buildContentDisposition('Röntgen 报告.pdf');
    expect(header).toContain('attachment;');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toMatch(/filename="[\x20-\x7E]*"/);
  });

  it('does not leak path traversal into the header', () => {
    const header = buildContentDisposition('../../etc/passwd');
    expect(header).not.toContain('..');
    expect(header).not.toContain('/');
  });

  it('strips control and bidi characters from the header', () => {
    const header = buildContentDisposition('a\u0000\u202Eb.pdf');
    expect(header).not.toMatch(/[\u0000-\u001F\u202A-\u202E]/);
  });
});

describe('sanitizeFileName', () => {
  it('returns display name, storage id, and original metadata separately', () => {
    const result = sanitizeFileName('Röntgen 报告.pdf');
    expect(result.displayName).toBe('Röntgen 报告.pdf');
    expect(result.storageId).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(result.originalName).toBe('Röntgen 报告.pdf');
  });

  it('keeps the original name only as metadata', () => {
    const result = sanitizeFileName('../../etc/passwd');
    expect(result.originalName).toBe('../../etc/passwd');
    expect(result.displayName).not.toContain('..');
    expect(result.storageId).not.toContain('..');
  });

  it('handles duplicate names via existing identifiers', () => {
    const first = sanitizeFileName('scan.pdf');
    const second = sanitizeFileName('scan.pdf', [first.storageId]);
    expect(second.storageId).not.toBe(first.storageId);
  });

  it('handles long Unicode names safely', () => {
    const result = sanitizeFileName('报告'.repeat(200) + '.pdf');
    expect(result.displayName.length).toBeLessThanOrEqual(255);
    expect(result.storageId.length).toBeLessThanOrEqual(255);
  });
});
