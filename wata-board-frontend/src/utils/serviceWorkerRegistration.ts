// Service Worker Registration utility for offline support

export type ServiceWorkerRegistrationStatus = 'idle' | 'installing' | 'installed' | 'activating' | 'activated' | 'redundant';

export interface ServiceWorkerRegistrationResult {
  success: boolean;
  registration?: ServiceWorkerRegistration;
  error?: string;
  status?: ServiceWorkerRegistrationStatus;
}

// Register service worker for offline support
export function registerServiceWorker(): Promise<ServiceWorkerRegistrationResult> {
  if ('serviceWorker' in navigator) {
    const swUrl = '/sw.js';

    return navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('[SW] Service worker registered successfully:', registration.scope);

        // Track service worker state changes
        const serviceWorker = registration.installing || registration.waiting || registration.active;
        
        if (serviceWorker) {
          serviceWorker.addEventListener('statechange', (event) => {
            const worker = event.target as ServiceWorker;
            console.log('[SW] Service worker state changed to:', worker.state);
          });
        }

        return {
          success: true,
          registration,
          status: getServiceWorkerStatus(registration)
        };
      })
      .catch((error) => {
        console.error('[SW] Service worker registration failed:', error);
        return {
          success: false,
          error: error.message
        };
      });
  } else {
    console.warn('[SW] Service workers are not supported in this browser');
    return Promise.resolve({
      success: false,
      error: 'Service workers are not supported in this browser'
    });
  }
}

// Get current service worker status
function getServiceWorkerStatus(registration: ServiceWorkerRegistration): ServiceWorkerRegistrationStatus {
  const installing = registration.installing;
  const waiting = registration.waiting;
  const active = registration.active;

  if (installing) return 'installing';
  if (waiting) return 'installed';
  if (active) return 'activated';
  return 'idle';
}

// Check for service worker updates
export function checkForServiceWorkerUpdates(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      console.log('[SW] Checking for updates...');
      registration.update();
    });
  }
}

// Unregister service worker (useful for development)
export function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready
      .then((registration) => {
        return registration.unregister();
      })
      .then((success) => {
        if (success) {
          console.log('[SW] Service worker unregistered successfully');
        } else {
          console.warn('[SW] Failed to unregister service worker');
        }
        return success;
      })
      .catch((error) => {
        console.error('[SW] Error unregistering service worker:', error);
        return false;
      });
  }
  return Promise.resolve(false);
}

// Listen for service worker messages
export function listenToServiceWorkerMessages(callback: (message: any) => void): () => void {
  if ('serviceWorker' in navigator) {
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        callback(event.data);
      }
    };

    navigator.serviceWorker.addEventListener('message', messageHandler);

    // Return cleanup function
    return () => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    };
  }

  return () => {}; // No-op if service workers not supported
}

// Send message to service worker
export function sendMessageToServiceWorker(message: any): Promise<any> {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        return new Promise((resolve) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data);
          };

          registration.active!.postMessage(message, [messageChannel.port2]);
        });
      }
      throw new Error('Service worker is not active');
    });
  }
  return Promise.reject(new Error('Service workers are not supported'));
}

// Get service worker version information
export function getServiceWorkerInfo(): Promise<{
  version?: string;
  scope?: string;
  state?: string;
} | null> {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready.then((registration) => {
      const active = registration.active;
      if (active) {
        return {
          version: active.scriptURL,
          scope: registration.scope,
          state: active.state
        };
      }
      return null;
    });
  }
  return Promise.resolve(null);
}

// Development helper: force refresh service worker
export function forceRefreshServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
      window.location.reload();
    });
  }
}
