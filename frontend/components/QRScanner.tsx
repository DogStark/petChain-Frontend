import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Permission lifecycle states surfaced to the UI.
type PermissionState = 'idle' | 'granted' | 'denied' | 'unsupported' | 'error';

// Expected QR payload schema. Only same-origin app links are accepted.
interface QRPayload {
  origin: string;
  code: string;
}

const ALLOWED_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const DUPLICATE_WINDOW_MS = 2000;

// Browser-specific recovery guidance shown when permission is denied.
function getRecoveryGuidance(): string {
  if (typeof navigator === 'undefined') {
    return 'Enable camera access in your browser settings and reload the page.';
  }
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) {
    return 'In Microsoft Edge, click the camera icon in the address bar, choose "Allow", then reload.';
  }
  if (/Firefox\//.test(ua)) {
    return 'In Firefox, open the permissions panel from the address bar, allow Camera, then reload.';
  }
  if (/Chrome\//.test(ua)) {
    return 'In Chrome, click the lock icon in the address bar, set Camera to "Allow", then reload.';
  }
  if (/Safari\//.test(ua)) {
    return 'In Safari, go to Settings > Websites > Camera, allow this site, then reload.';
  }
  return 'Enable camera access in your browser settings and reload the page.';
}

// Validate a raw scanned/typed string against the expected origin + schema.
function parsePayload(raw: string): QRPayload | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, ALLOWED_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ALLOWED_ORIGIN) return null;
  const code = url.searchParams.get('code');
  if (!code || !/^[A-Za-z0-9-]{4,64}$/.test(code)) return null;
  return { origin: url.origin, code };
}

const QRScanner: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPayloadRef = useRef<{ value: string; at: number } | null>(null);

  const [permission, setPermission] = useState<PermissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Shared validation + navigation path for both camera and manual input.
  const handlePayload = useCallback(
    (raw: string) => {
      const parsed = parsePayload(raw);
      if (!parsed) {
        setError('This QR code is not a valid app link. Check the code and try again.');
        return;
      }
      const now = Date.now();
      const last = lastPayloadRef.current;
      if (last && last.value === parsed.code && now - last.at < DUPLICATE_WINDOW_MS) {
        return;
      }
      lastPayloadRef.current = { value: parsed.code, at: now };
      setError(null);
      navigate(`/redeem?code=${encodeURIComponent(parsed.code)}`);
    },
    [navigate],
  );

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      setError('Camera scanning is not supported in this browser. Enter the code manually.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPermission('granted');
      setError(null);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermission('denied');
        setError(getRecoveryGuidance());
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setPermission('error');
        setError('No usable camera was found. Enter the code manually.');
      } else {
        setPermission('error');
        setError('The camera could not be started. Enter the code manually.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  // Stop tracks when the page is hidden or unloaded.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') stopStream();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stopStream);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stopStream);
    };
  }, [stopStream]);

  const onSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    handlePayload(manualCode.trim());
  };

  return (
    <div className="qr-scanner">
      <video ref={videoRef} className="qr-scanner__video" muted playsInline />

      {permission === 'denied' && (
        <div role="alert" className="qr-scanner__recovery">
          <p>{error}</p>
          <button type="button" onClick={startCamera}>
            Retry camera access
          </button>
        </div>
      )}

      {(permission === 'unsupported' || permission === 'error') && error && (
        <p role="alert" className="qr-scanner__error">
          {error}
        </p>
      )}

      <form className="qr-scanner__manual" onSubmit={onSubmitManual}>
        <label htmlFor="manual-code">Enter code manually</label>
        <input
          id="manual-code"
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="e.g. https://app.example.com/redeem?code=ABC123"
          autoComplete="off"
        />
        <button type="submit">Submit code</button>
      </form>

      {error && permission === 'granted' && (
        <p role="alert" className="qr-scanner__error">
          {error}
        </p>
      )}
    </div>
  );
};

export default QRScanner;
