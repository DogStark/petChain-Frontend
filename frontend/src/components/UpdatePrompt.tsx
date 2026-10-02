'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Coordinates service-worker updates and provides a safe recovery path.
 *
 * - Shows a controlled prompt when a new worker is waiting, so activation
 *   (and the removal of obsolete caches) only happens on user consent.
 * - Offers a recovery action that bypasses stale caches by unregistering the
 *   worker and reloading with cache-busting, WITHOUT clearing localStorage,
 *   sessionStorage, IndexedDB, or cookies (medical data / credentials stay).
 */

export interface UpdatePromptProps {
  /** Optional build id used to label the pending version. */
  buildId?: string;
  /** Optional callback invoked right before a recovery reload. */
  onRecover?: () => void;
}

type UpdateState = 'idle' | 'waiting' | 'activating' | 'recovering';

export default function UpdatePrompt({ buildId, onRecover }: UpdatePromptProps) {
  const [state, setState] = useState<UpdateState>('idle');
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let disposed = false;

    const trackWaiting = (registration: ServiceWorkerRegistration) => {
      if (disposed) return;
      if (registration.waiting) {
        waitingWorkerRef.current = registration.waiting;
        setState('waiting');
      }
    };

    const onControllerChange = () => {
      // New worker took control: reload once to pick up the intended version.
      if (disposed) return;
      setState('idle');
      window.location.reload();
    };

    navigator.serviceWorker.ready.then((registration) => {
      trackWaiting(registration);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = registration.waiting ?? installing;
            setState('waiting');
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingWorkerRef.current;
    if (!waiting) {
      setState('idle');
      return;
    }
    setState('activating');
    // Tell the waiting worker to activate; obsolete caches are removed by the
    // worker itself only after it is ready. controllerchange triggers reload.
    waiting.postMessage({ type: 'SKIP_WAITING', buildId });
  }, [buildId]);

  const recover = useCallback(async () => {
    setState('recovering');
    onRecover?.();
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {
      // Even if unregistering fails, the cache-busting reload below still
      // bypasses stale caches. Never touch user data here.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('__sw_recover', Date.now().toString());
    window.location.replace(url.toString());
  }, [onRecover]);

  if (state === 'idle') {
    return null;
  }

  const busy = state === 'activating' || state === 'recovering';

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="Application update available"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        maxWidth: 360,
        padding: 16,
        borderRadius: 8,
        background: '#111827',
        color: '#f9fafb',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
        {state === 'recovering' ? 'Recovering…' : 'A new version is available'}
      </p>
      {buildId ? (
        <p style={{ margin: '0 0 12px', opacity: 0.75, fontSize: 12 }}>Version {buildId}</p>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={applyUpdate}
          disabled={busy}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {state === 'activating' ? 'Updating…' : 'Update now'}
        </button>
        <button
          type="button"
          onClick={recover}
          disabled={busy}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #4b5563',
            background: 'transparent',
            color: '#f9fafb',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {state === 'recovering' ? 'Recovering…' : 'Having trouble? Recover'}
        </button>
      </div>
    </div>
  );
}
