import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import {
  PWA_INSTALL_ENGAGEMENT_THRESHOLD,
  dismissInstallPrompt,
  isInstallPromptDismissed,
  recordEngagement,
} from '@/hooks/usePWA';

export interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

const INSTALL_BENEFITS = [
  'Works offline with cached pet records',
  'Faster launch from your home screen',
  'Instant access to emergency info',
];

export function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const installButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    installButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-description"
      className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/PETCHAIN.jpeg"
          alt=""
          aria-hidden="true"
          width={48}
          height={48}
          className="rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p id="pwa-install-title" className="font-semibold text-gray-900 text-sm">
            Install PetChain
          </p>
          <p id="pwa-install-description" className="text-xs text-gray-500">
            Add PetChain to your device for a faster, offline-ready experience.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc list-inside">
            {INSTALL_BENEFITS.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Not now
        </button>
        <button
          ref={installButtonRef}
          type="button"
          onClick={onInstall}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Install
        </button>
      </div>
    </div>
  );
}

export interface PWAInstallGateProps {
  isInstallable: boolean;
  onInstall: () => void;
}

/**
 * Renders the custom install prompt only once the user has crossed the
 * engagement threshold and has not previously dismissed it.
 */
export function PWAInstallGate({ isInstallable, onInstall }: PWAInstallGateProps) {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (isInstallPromptDismissed()) return;
    const count = recordEngagement();
    if (count >= PWA_INSTALL_ENGAGEMENT_THRESHOLD) {
      setEligible(true);
    }
  }, []);

  const handleDismiss = () => {
    dismissInstallPrompt();
    setEligible(false);
  };

  if (!isInstallable || !eligible || isInstallPromptDismissed()) return null;

  return <PWAInstallPrompt onInstall={onInstall} onDismiss={handleDismiss} />;
}

interface PWAUpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function PWAUpdateBanner({ onUpdate, onDismiss }: PWAUpdateBannerProps) {
  return (
    <div
      role="alert"
      className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto bg-blue-600 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3"
    >
      <span className="text-xl flex-shrink-0">🔄</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Update available</p>
        <p className="text-xs text-blue-100">A new version of PetChain is ready.</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded-lg transition-colors"
        >
          Later
        </button>
        <button
          onClick={onUpdate}
          className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}

interface OfflineBannerProps {
  isOffline: boolean;
}

export function OfflineBanner({ isOffline }: OfflineBannerProps) {
  if (!isOffline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-2 px-4 font-medium"
    >
      📵 You&apos;re offline — showing cached data
    </div>
  );
}
