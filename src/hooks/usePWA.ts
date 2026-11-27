import { useState, useEffect, useCallback, useRef } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  isUpdateAvailable: boolean;
  promptInstall: () => Promise<boolean>;
  applyUpdate: () => void;
  emergencyReset: () => Promise<void>;
}

/** localStorage key persisting the user's dismissal of the install prompt. */
export const PWA_INSTALL_DISMISSED_KEY = 'petchain-pwa-install-dismissed';

/** Number of page views required before the install prompt is offered. */
export const PWA_INSTALL_ENGAGEMENT_THRESHOLD = 3;

/** localStorage key counting page views used for the engagement threshold. */
export const PWA_ENGAGEMENT_COUNT_KEY = 'petchain-pwa-engagement-count';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

export function isInstallPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return readStorage(PWA_INSTALL_DISMISSED_KEY) === 'true';
}

export function dismissInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  writeStorage(PWA_INSTALL_DISMISSED_KEY, 'true');
}

export function getEngagementCount(): number {
  if (typeof window === 'undefined') return 0;
  const raw = readStorage(PWA_ENGAGEMENT_COUNT_KEY);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function recordEngagement(): number {
  if (typeof window === 'undefined') return 0;
  const next = getEngagementCount() + 1;
  writeStorage(PWA_ENGAGEMENT_COUNT_KEY, String(next));
  return next;
}

export function usePWA(): PWAState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Online/offline detection
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (!isInstallPromptDismissed()) {
        setIsInstallable(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Track successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt.current = null;
      dismissInstallPrompt();
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          swRegistration.current = reg;

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setIsUpdateAvailable(true);
              }
            });
          });
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[PWA] SW registration failed:', err);
          }
        });

      // Listen for SW messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[PWA] Background sync completed');
          }
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt.current) return false;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setIsInstallable(false);
    if (outcome === 'dismissed') {
      dismissInstallPrompt();
    }
    return outcome === 'accepted';
  }, []);

  const applyUpdate = useCallback(() => {
    if (!swRegistration.current?.waiting) return;
    swRegistration.current.waiting.postMessage({ type: 'SKIP_WAITING' });
    setIsUpdateAvailable(false);
    window.location.reload();
  }, []);

  const emergencyReset = useCallback(async () => {
    return new Promise<void>((resolve) => {
      if (!('serviceWorker' in navigator)) {
        window.location.reload();
        resolve();
        return;
      }

      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) {
          window.location.reload();
          resolve();
          return;
        }

        const handleResetComplete = (event: MessageEvent) => {
          if (event.data?.type === 'EMERGENCY_RESET_COMPLETE') {
            navigator.serviceWorker.removeEventListener('message', handleResetComplete);
            window.location.reload();
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener('message', handleResetComplete);

        for (const registration of registrations) {
          if (registration.active) {
            registration.active.postMessage({ type: 'EMERGENCY_RESET' });
          } else {
            registration.unregister().then(() => {
              window.location.reload();
              resolve();
            });
          }
        }
      });
    });
  }, []);

  return { isInstallable, isInstalled, isOffline, isUpdateAvailable, promptInstall, applyUpdate, emergencyReset };
}
