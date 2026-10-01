'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_ORIGINS = [
  typeof window !== 'undefined' ? window.location.origin : '',
  'https://app.example.com',
].filter(Boolean);

const CODE_PATTERN = /^[A-Za-z0-9-]{4,64}$/;

function validatePayload(raw: string): { ok: true; code: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, error: 'Enter a code to continue.' };
  }
  if (CODE_PATTERN.test(value)) {
    return { ok: true, code: value };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: 'This QR code is not a valid link or code.' };
  }
  if (!ALLOWED_ORIGINS.includes(url.origin)) {
    return { ok: false, error: 'This QR code points to an untrusted origin.' };
  }
  const code = url.searchParams.get('code') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, error: 'This QR code is missing a valid code.' };
  }
  return { ok: true, code };
}

type PermissionState = 'idle' | 'granted' | 'denied' | 'unsupported' | 'error';

function recoveryGuidance(): string {
  if (typeof navigator === 'undefined') {
    return 'Enable camera access in your browser settings, then reload this page.';
  }
  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) {
    return 'Firefox: open the lock icon in the address bar, clear the camera block, then reload.';
  }
  if (/Edg/i.test(ua)) {
    return 'Edge: go to Settings > Cookies and site permissions > Camera and allow this site.';
  }
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    return 'Safari: open Settings > Safari > Camera and set it to Allow, then reload.';
  }
  return 'Chrome: click the lock icon in the address bar, set Camera to Allow, then reload.';
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastPayloadRef = useRef<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handlePayload = useCallback(
    (raw: string) => {
      const result = validatePayload(raw);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (lastPayloadRef.current === result.code) {
        return;
      }
      lastPayloadRef.current = result.code;
      setError(null);
      router.push(`/scan/${encodeURIComponent(result.code)}`);
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPermission('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setPermission('granted');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setPermission('denied');
        } else if (name === 'NotFoundError' || name === 'NotSupportedError') {
          setPermission('unsupported');
        } else {
          setPermission('error');
          setError('The camera could not be started. Try again or enter a code manually.');
        }
      }
    }

    start();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopStream();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopStream();
    };
  }, [stopStream]);

  const onSubmitManual = (event: React.FormEvent) => {
    event.preventDefault();
    handlePayload(manualCode);
  };

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Scan a QR code</h1>

      {permission === 'granted' && (
        <video
          ref={videoRef}
          className="aspect-square w-full rounded-lg bg-black"
          muted
          playsInline
        />
      )}

      {permission === 'denied' && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Camera access is blocked.</p>
          <p className="mt-1">{recoveryGuidance()}</p>
        </div>
      )}

      {permission === 'unsupported' && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Camera scanning is not available in this browser.</p>
          <p className="mt-1">Enter the code manually below to continue.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={onSubmitManual} className="flex flex-col gap-2">
        <label htmlFor="manual-code" className="text-sm font-medium">
          Enter code manually
        </label>
        <input
          id="manual-code"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
          placeholder="e.g. ABC-1234"
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={!manualCode.trim()}
        >
          Continue
        </button>
      </form>
    </main>
  );
}
