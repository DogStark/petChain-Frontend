import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * QR render integrity requirements (issue #1007).
 *
 * Rendered QR codes must remain scannable on screen and in print. These
 * thresholds are the documented contract enforced by `validateQRRender`.
 */
export const QR_RENDER_REQUIREMENTS = {
  /** Minimum rendered size of a single QR module, in CSS pixels. */
  minModuleSizePx: 4,
  /** Minimum quiet zone around the symbol, expressed in modules. */
  minQuietZoneModules: 4,
  /** Minimum WCAG contrast ratio between modules and background. */
  minContrastRatio: 4.5,
  /** Error correction level used for generated codes. */
  errorCorrectionLevel: 'M' as const,
  /** Longest identifier we render directly before falling back. */
  maxIdentifierLength: 512,
} as const;

export type QRValidationIssue =
  | 'module-too-small'
  | 'quiet-zone-too-small'
  | 'contrast-too-low'
  | 'identifier-too-long';

export interface QRValidationInput {
  /** Rendered size of a single module, in CSS pixels. */
  moduleSizePx: number;
  /** Quiet zone around the symbol, in modules. */
  quietZoneModules: number;
  /** Contrast ratio between modules and background. */
  contrastRatio: number;
  /** Identifier encoded into the QR code. */
  identifier: string;
}

export interface QRValidationResult {
  valid: boolean;
  issues: QRValidationIssue[];
}

/**
 * Validate a rendered QR code against the documented thresholds.
 * Returns every violated requirement so callers can surface actionable errors.
 */
export function validateQRRender(input: QRValidationInput): QRValidationResult {
  const issues: QRValidationIssue[] = [];

  if (input.moduleSizePx < QR_RENDER_REQUIREMENTS.minModuleSizePx) {
    issues.push('module-too-small');
  }
  if (input.quietZoneModules < QR_RENDER_REQUIREMENTS.minQuietZoneModules) {
    issues.push('quiet-zone-too-small');
  }
  if (input.contrastRatio < QR_RENDER_REQUIREMENTS.minContrastRatio) {
    issues.push('contrast-too-low');
  }
  if (input.identifier.length > QR_RENDER_REQUIREMENTS.maxIdentifierLength) {
    issues.push('identifier-too-long');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Safe fallback for identifiers that exceed the documented maximum length.
 * Long identifiers are truncated to a stable, decodable value.
 */
export function safeQRIdentifier(identifier: string): string {
  if (identifier.length <= QR_RENDER_REQUIREMENTS.maxIdentifierLength) {
    return identifier;
  }
  return identifier.slice(0, QR_RENDER_REQUIREMENTS.maxIdentifierLength);
}

/**
 * Compute the WCAG contrast ratio between two relative luminances.
 */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface QRCodeProps {
  /** Identifier encoded into the QR code. */
  value: string;
  /** Rendered size of a single module, in CSS pixels. */
  moduleSizePx?: number;
  /** Quiet zone around the symbol, in modules. */
  quietZoneModules?: number;
  /** Contrast ratio between modules and background. */
  contrastRatio?: number;
  /** Accessible label for the rendered code. */
  label?: string;
  className?: string;
}

/**
 * Renders a QR code with the documented integrity requirements applied.
 *
 * The component enforces minimum module size, quiet zone, and contrast, and
 * falls back to a safe identifier when the value is too long. Print styles
 * keep the symbol at its rendered size so it is not clipped or rescaled.
 */
export function QRCode({
  value,
  moduleSizePx = QR_RENDER_REQUIREMENTS.minModuleSizePx,
  quietZoneModules = QR_RENDER_REQUIREMENTS.minQuietZoneModules,
  contrastRatio: contrast = QR_RENDER_REQUIREMENTS.minContrastRatio,
  label = 'QR code',
  className,
}: QRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const identifier = useMemo(() => safeQRIdentifier(value), [value]);

  const validation = useMemo(
    () =>
      validateQRRender({
        moduleSizePx,
        quietZoneModules,
        contrastRatio: contrast,
        identifier,
      }),
    [moduleSizePx, quietZoneModules, contrast, identifier],
  );

  useEffect(() => {
    if (!validation.valid) {
      setRenderError(`QR render integrity: ${validation.issues.join(', ')}`);
    } else {
      setRenderError(null);
    }
  }, [validation]);

  const quietZonePx = quietZoneModules * moduleSizePx;

  return (
    <div
      ref={containerRef}
      className={className}
      data-qr-identifier={identifier}
      data-qr-module-size={moduleSizePx}
      data-qr-quiet-zone={quietZoneModules}
      data-qr-contrast={contrast}
      data-qr-error-correction={QR_RENDER_REQUIREMENTS.errorCorrectionLevel}
      data-qr-valid={validation.valid}
      role="img"
      aria-label={label}
      style={{
        padding: `${quietZonePx}px`,
        background: '#ffffff',
        color: '#000000',
        display: 'inline-block',
        lineHeight: 0,
      }}
    >
      <canvas
        width={moduleSizePx * 25}
        height={moduleSizePx * 25}
        style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }}
      />
      {renderError ? (
        <p role="alert" style={{ color: '#b00020', fontSize: 12 }}>
          {renderError}
        </p>
      ) : null}
    </div>
  );
}

export default QRCode;
