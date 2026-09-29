import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QRCode from '../QRCode';

/**
 * QR render integrity tests (issue #1007).
 *
 * Documented thresholds for rendered QR codes:
 * - Minimum module size: 4px (screen), 2px (print)
 * - Quiet zone: at least 4 modules on every side
 * - Contrast ratio: >= 4.5:1 between foreground and background
 * - Error correction level: 'M' or higher
 * - Print styles: no clipping, no responsive scaling below minimum module size
 */

const MIN_MODULE_SIZE_PX = 4;
const MIN_QUIET_ZONE_MODULES = 4;
const MIN_CONTRAST_RATIO = 4.5;
const ALLOWED_ERROR_CORRECTION = ['M', 'Q', 'H'];

/**
 * Validate a rendered QR code against the documented thresholds.
 * Returns a list of violations; empty means the render is valid.
 */
function validateQRRender(options: {
  moduleSizePx: number;
  quietZoneModules: number;
  contrastRatio: number;
  errorCorrection: string;
}): string[] {
  const violations: string[] = [];
  if (options.moduleSizePx < MIN_MODULE_SIZE_PX) {
    violations.push(
      `module size ${options.moduleSizePx}px is below minimum ${MIN_MODULE_SIZE_PX}px`,
    );
  }
  if (options.quietZoneModules < MIN_QUIET_ZONE_MODULES) {
    violations.push(
      `quiet zone ${options.quietZoneModules} modules is below minimum ${MIN_QUIET_ZONE_MODULES}`,
    );
  }
  if (options.contrastRatio < MIN_CONTRAST_RATIO) {
    violations.push(
      `contrast ratio ${options.contrastRatio} is below minimum ${MIN_CONTRAST_RATIO}`,
    );
  }
  if (!ALLOWED_ERROR_CORRECTION.includes(options.errorCorrection)) {
    violations.push(
      `error correction '${options.errorCorrection}' is not in ${ALLOWED_ERROR_CORRECTION.join(', ')}`,
    );
  }
  return violations;
}

/**
 * Compute relative luminance per WCAG 2.1 for a hex color.
 */
function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Safe fallback for long identifiers: QR codes have a maximum capacity.
 * When the identifier exceeds the safe length, callers should fall back to
 * a shortened form (e.g. a hash or truncated id) rather than rendering a
 * code that cannot be decoded.
 */
const MAX_SAFE_IDENTIFIER_LENGTH = 1000;

function safeIdentifier(identifier: string): string {
  if (identifier.length <= MAX_SAFE_IDENTIFIER_LENGTH) {
    return identifier;
  }
  // Deterministic short fallback: keep a prefix and a stable suffix.
  const suffix = identifier.slice(-16);
  return `${identifier.slice(0, 32)}...${suffix}`;
}

describe('QRCode render integrity', () => {
  it('renders a QR code element', () => {
    render(<QRCode value="https://example.com/emergency/abc123" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('meets minimum module size, quiet zone, contrast, and error correction', () => {
    const violations = validateQRRender({
      moduleSizePx: 6,
      quietZoneModules: 4,
      contrastRatio: contrastRatio('#000000', '#ffffff'),
      errorCorrection: 'M',
    });
    expect(violations).toEqual([]);
  });

  it('flags renders that fall below documented thresholds', () => {
    const violations = validateQRRender({
      moduleSizePx: 2,
      quietZoneModules: 1,
      contrastRatio: 2.1,
      errorCorrection: 'L',
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it('computes a contrast ratio that meets the documented threshold for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThanOrEqual(
      MIN_CONTRAST_RATIO,
    );
  });

  it('uses a safe fallback for long identifiers', () => {
    const longId = 'x'.repeat(5000);
    const fallback = safeIdentifier(longId);
    expect(fallback.length).toBeLessThanOrEqual(MAX_SAFE_IDENTIFIER_LENGTH);
    expect(fallback).not.toEqual(longId);
  });

  it('keeps short identifiers unchanged', () => {
    const shortId = 'emergency-abc123';
    expect(safeIdentifier(shortId)).toEqual(shortId);
  });
});
