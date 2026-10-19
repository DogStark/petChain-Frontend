import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

/**
 * Canonical versioned schema for emergency QR payloads.
 *
 * The payload is a compact, deterministic JSON document that carries a
 * schema version and an integrity checksum so that a stale or truncated
 * payload can be detected before it is rendered or downloaded.
 */
export const EMERGENCY_QR_SCHEMA_VERSION = 1;

/** Maximum encoded payload size (bytes) we are willing to render. */
export const EMERGENCY_QR_MAX_BYTES = 2048;

/** Default QR render size in pixels. */
const DEFAULT_SIZE = 256;

/** Quiet zone (modules) required for reliable scanning. */
const QUIET_ZONE = 4;

export interface EmergencyProfile {
  id: string;
  name: string;
  bloodType?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  emergencyContact?: string;
  notes?: string;
}

export interface EmergencyQRPayload {
  v: number;
  id: string;
  name: string;
  bloodType?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  emergencyContact?: string;
  notes?: string;
  /** Integrity checksum over the canonical body. */
  sum: string;
}

export interface EmergencyQRProps {
  profile: EmergencyProfile;
  /** ISO timestamp after which the payload is considered expired. */
  expiresAt?: string;
  /** When true the profile has been revoked and must not be rendered. */
  revoked?: boolean;
  size?: number;
  className?: string;
  onError?: (message: string) => void;
}

/**
 * Deterministic FNV-1a 32-bit hash rendered as an 8 char hex string.
 * Used as the integrity checksum for the canonical payload body.
 */
export function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Build the canonical, versioned payload body (without checksum).
 * Keys are emitted in a fixed order so the checksum is stable.
 */
export function canonicalBody(profile: EmergencyProfile): string {
  const body = {
    v: EMERGENCY_QR_SCHEMA_VERSION,
    id: profile.id,
    name: profile.name,
    bloodType: profile.bloodType ?? '',
    allergies: profile.allergies ?? [],
    medications: profile.medications ?? [],
    conditions: profile.conditions ?? [],
    emergencyContact: profile.emergencyContact ?? '',
    notes: profile.notes ?? '',
  };
  return JSON.stringify(body);
}

/**
 * Build the canonical versioned payload including integrity data.
 */
export function buildPayload(profile: EmergencyProfile): EmergencyQRPayload {
  const body = canonicalBody(profile);
  return {
    ...JSON.parse(body),
    sum: checksum(body),
  } as EmergencyQRPayload;
}

/**
 * Validate a decoded payload string. Returns an actionable error message
 * when the payload is revoked, expired, oversized, truncated or tampered.
 */
export function validatePayload(
  raw: string,
  options: { revoked?: boolean; expiresAt?: string } = {},
): { ok: true; payload: EmergencyQRPayload } | { ok: false; error: string } {
  if (options.revoked) {
    return { ok: false, error: 'This emergency profile has been revoked. Generate a new QR code.' };
  }

  if (options.expiresAt) {
    const expiry = Date.parse(options.expiresAt);
    if (!Number.isNaN(expiry) && Date.now() > expiry) {
      return { ok: false, error: 'This emergency QR code has expired. Refresh the profile and try again.' };
    }
  }

  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > EMERGENCY_QR_MAX_BYTES) {
    return {
      ok: false,
      error: `Emergency QR payload is too large (${bytes} bytes). Reduce profile fields to ${EMERGENCY_QR_MAX_BYTES} bytes or fewer.`,
    };
  }

  let parsed: EmergencyQRPayload;
  try {
    parsed = JSON.parse(raw) as EmergencyQRPayload;
  } catch {
    return { ok: false, error: 'Emergency QR payload is truncated or malformed. Regenerate the QR code.' };
  }

  if (!parsed || typeof parsed !== 'object' || parsed.v !== EMERGENCY_QR_SCHEMA_VERSION) {
    return { ok: false, error: 'Unsupported emergency QR schema version. Update the app and regenerate.' };
  }

  const { sum, ...body } = parsed;
  const expected = checksum(JSON.stringify(body));
  if (sum !== expected) {
    return { ok: false, error: 'Emergency QR integrity check failed. The payload may be stale or tampered with.' };
  }

  return { ok: true, payload: parsed };
}

/**
 * Render a QR code to a data URL and verify the decode round-trip.
 */
async function renderAndVerify(
  payload: EmergencyQRPayload,
  size: number,
): Promise<{ dataUrl: string; verified: boolean }> {
  const text = JSON.stringify(payload);
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: QUIET_ZONE,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Decode the rendered image back to text to confirm the round-trip.
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl, verified: false };
  }
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height);
  const verified = !!decoded && decoded.data === text;
  return { dataUrl, verified };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load rendered QR image.'));
    img.src = src;
  });
}

const EmergencyQR: React.FC<EmergencyQRProps> = ({
  profile,
  expiresAt,
  revoked = false,
  size = DEFAULT_SIZE,
  className,
  onError,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const payload = useMemo(() => buildPayload(profile), [profile]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVerified(false);
    setDataUrl(null);

    const raw = JSON.stringify(payload);
    const validation = validatePayload(raw, { revoked, expiresAt });
    if (!validation.ok) {
      setLoading(false);
      setError(validation.error);
      onError?.(validation.error);
      return () => {
        cancelled = true;
      };
    }

    renderAndVerify(payload, size)
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setDataUrl(result.dataUrl);
        setVerified(result.verified);
        if (!result.verified) {
          const message = 'QR decode round-trip failed. The rendered code may not scan correctly.';
          setError(message);
          onError?.(message);
        }
      })
      .catch((err: unknown) => {
        if (cancelled || !mounted.current) return;
        const message = err instanceof Error ? err.message : 'Failed to render emergency QR code.';
        setError(message);
        onError?.(message);
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [payload, size, revoked, expiresAt, onError]);

  const canDownload = !!dataUrl && verified && !error;

  const handleDownload = useCallback(() => {
    if (!canDownload || !dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `emergency-qr-${profile.id}.png`;
    link.click();
  }, [canDownload, dataUrl, profile.id]);

  const handlePrint = useCallback(() => {
    if (!canDownload || !dataUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<html><head><title>Emergency QR</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;"><img src="${dataUrl}" alt="Emergency QR code" style="width:${size}px;height:${size}px;" /></body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }, [canDownload, dataUrl, size]);

  return (
    <div className={className} data-testid="emergency-qr">
      {loading && <p role="status">Generating emergency QR code…</p>}

      {error && (
        <p role="alert" data-testid="emergency-qr-error">
          {error}
        </p>
      )}

      {dataUrl && !error && (
        <img
          src={dataUrl}
          alt="Emergency QR code"
          width={size}
          height={size}
          data-testid="emergency-qr-image"
        />
      )}

      <div>
        <button type="button" onClick={handleDownload} disabled={!canDownload}>
          Download
        </button>
        <button type="button" onClick={handlePrint} disabled={!canDownload}>
          Print
        </button>
      </div>
    </div>
  );
};

export default EmergencyQR;
