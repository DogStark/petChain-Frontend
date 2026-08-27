export interface ServiceWorkerCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export function registerServiceWorker(
  swUrl: string = '/sw.js',
  callbacks: ServiceWorkerCallbacks = {}
): void {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this browser');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.onstatechange = () => {
            if (installing.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[SW] New content available; please refresh.');
                callbacks.onUpdate?.(registration);
              } else {
                console.log('[SW] Content is cached for offline use.');
                callbacks.onSuccess?.(registration);
              }
            }
          };
        };
      })
      .catch((error: Error) => {
        console.error('[SW] Registration failed:', error);
        callbacks.onError?.(error);
      });
  });
}

export function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(false);

  return navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .then((success) => {
      if (success) console.log('[SW] Unregistered successfully');
      return success;
    })
    .catch((error) => {
      console.error('[SW] Unregister failed:', error);
      return false;
    });
}

export function checkForUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => registration.update());
}
