/**
 * QR code render integrity validation.
 *
 * Rendered QR codes can be clipped, low contrast, or altered by responsive CSS,
 * making emergency scanning unreliable. This module documents the minimum
 * thresholds a rendered QR code must meet and exposes a helper to validate a
 * generated code against them.
 *
 * Documented thresholds (see README "QR render integrity"):
 * - Minimum module size: 4 CSS px (screen), 2 CSS px (print).
 * - Quiet zone: at least 4 modules on every side.
 * - Contrast ratio: at least 4.5:1 between dark and light modules.
 * - Error correction: at least level "M" (15%).
 * - Print styles: QR must not be scaled below its minimum module size and must
 *   keep its quiet zone when printed.
 */

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QrRenderTarget = 'screen' | 'print';

export interface QrRenderSpec {
  /** Number of modules per side (excluding the quiet zone). */
  moduleCount: number;
  /** Rendered size of a single module, in CSS pixels. */
  moduleSizePx: number;
  /** Quiet zone width, in modules, on each side. */
  quietZoneModules: number;
  /** Contrast ratio between dark and light modules (e.g. 21 for black/white). */
  contrastRatio: number;
  /** Error correction level used when generating the code. */
  errorCorrectionLevel: QrErrorCorrectionLevel;
  /** Where the code will be rendered. */
  target?: QrRenderTarget;
}

export interface QrValidationIssue {
  code:
    | 'module-size'
    | 'quiet-zone'
    | 'contrast'
    | 'error-correction'
    | 'fallback';
  message: string;
}

export interface QrValidationResult {
  valid: boolean;
  issues: QrValidationIssue[];
}

/** Minimum module size in CSS pixels, per render target. */
export const MIN_MODULE_SIZE_PX: Record<QrRenderTarget, number> = {
  screen: 4,
  print: 2,
};

/** Minimum quiet zone, in modules, on every side. */
export const MIN_QUIET_ZONE_MODULES = 4;

/** Minimum contrast ratio between dark and light modules. */
export const MIN_CONTRAST_RATIO = 4.5;

/** Error correction levels ordered from weakest to strongest. */
const ERROR_CORRECTION_ORDER: QrErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

/** Minimum accepted error correction level. */
export const MIN_ERROR_CORRECTION_LEVEL: QrErrorCorrectionLevel = 'M';

/**
 * Longest identifier (in characters) that is safe to encode without a fallback.
 * Beyond this, callers should use {@link getSafeQrPayload} so the code stays
 * scannable instead of growing past the minimum module size.
 */
export const MAX_SAFE_IDENTIFIER_LENGTH = 512;

/**
 * Returns a payload that is safe to encode. Long identifiers are truncated to
 * {@link MAX_SAFE_IDENTIFIER_LENGTH} characters so the resulting code keeps a
 * scannable module size instead of being scaled down by responsive CSS.
 */
export function getSafeQrPayload(identifier: string): string {
  if (identifier.length <= MAX_SAFE_IDENTIFIER_LENGTH) {
    return identifier;
  }
  return identifier.slice(0, MAX_SAFE_IDENTIFIER_LENGTH);
}

/**
 * Validates a rendered QR code against the documented thresholds. Returns every
 * issue found so callers can surface actionable guidance.
 */
export function validateQrRender(spec: QrRenderSpec): QrValidationResult {
  const issues: QrValidationIssue[] = [];
  const target: QrRenderTarget = spec.target ?? 'screen';
  const minModuleSize = MIN_MODULE_SIZE_PX[target];

  if (!Number.isFinite(spec.moduleSizePx) || spec.moduleSizePx < minModuleSize) {
    issues.push({
      code: 'module-size',
      message: `Module size ${spec.moduleSizePx}px is below the ${minModuleSize}px minimum for ${target}.`,
    });
  }

  if (
    !Number.isFinite(spec.quietZoneModules) ||
    spec.quietZoneModules < MIN_QUIET_ZONE_MODULES
  ) {
    issues.push({
      code: 'quiet-zone',
      message: `Quiet zone ${spec.quietZoneModules} modules is below the ${MIN_QUIET_ZONE_MODULES}-module minimum.`,
    });
  }

  if (!Number.isFinite(spec.contrastRatio) || spec.contrastRatio < MIN_CONTRAST_RATIO) {
    issues.push({
      code: 'contrast',
      message: `Contrast ratio ${spec.contrastRatio}:1 is below the ${MIN_CONTRAST_RATIO}:1 minimum.`,
    });
  }

  const levelIndex = ERROR_CORRECTION_ORDER.indexOf(spec.errorCorrectionLevel);
  const minLevelIndex = ERROR_CORRECTION_ORDER.indexOf(MIN_ERROR_CORRECTION_LEVEL);
  if (levelIndex < minLevelIndex) {
    issues.push({
      code: 'error-correction',
      message: `Error correction level "${spec.errorCorrectionLevel}" is below the required "${MIN_ERROR_CORRECTION_LEVEL}".`,
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Computes the total rendered size (in CSS pixels) of a QR code including its
 * quiet zone. Useful for asserting that responsive CSS has not scaled a code
 * below its minimum module size.
 */
export function getRenderedSizePx(spec: QrRenderSpec): number {
  const totalModules = spec.moduleCount + spec.quietZoneModules * 2;
  return totalModules * spec.moduleSizePx;
}
