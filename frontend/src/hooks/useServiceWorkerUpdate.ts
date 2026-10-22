import { useCallback, useEffect, useRef, useState } from 'react';

export interface ServiceWorkerUpdateState {
  /** Whether a new service worker is waiting to activate. */
  hasUpdate: boolean;
  /** Whether the user has deferred the update. */
  isDeferred: boolean;
  /** Whether the update is currently being applied. */
  isApplying: boolean;
  /** Last error encountered while applying the update. */
  error: Error | null;
  /** Apply the waiting update immediately. */
  applyUpdate: () => Promise<void>;
  /** Defer the update until a convenient moment. */
  deferUpdate: () => void;
  /** Re-show the deferred update banner. */
  showUpdate: () => void;
  /** Clear any previous error. */
  clearError: () => void;
}

export interface UseServiceWorkerUpdateOptions {
  /** Container that owns the service worker registration. Defaults to `navigator.serviceWorker`. */
  container?: ServiceWorkerContainer | null;
  /** Optional callback that returns true when applying the update would discard open clinical forms. */
  isApplyBlocked?: () => boolean;
  /** Message shown when apply is blocked. */
  blockedMessage?: string;
  /** Optional callback invoked when an update is applied. */
  onUpdateApplied?: () => void;
}

export function getServiceWorkerContainer(): ServiceWorkerContainer | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  return navigator.serviceWorker ?? null;
}

export function useServiceWorkerUpdate(
  options: UseServiceWorkerUpdateOptions = {},
): ServiceWorkerUpdateState {
  const {
    container,
    isApplyBlocked,
    blockedMessage,
    onUpdateApplied,
  } = options;

  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isDeferred, setIsDeferred] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const swcontainer = container ?? getServiceWorkerContainer();
    if (!swcontainer) {
      return undefined;
    }

    let disposed = false;
    const cleanups: Array< () => void > = [];

    const handleWorker = (worker: ServiceWorker) => {
      if (disposed) {
        return;
      }
      if (worker.state === 'installed') {
        setWaitingWorker(worker);
        setIsDeferred(false);
        return;
      }
      const onStateChange = () => {
        if (disposed) {
          return;
        }
        if (worker.state === 'installed') {
          setWaitingWorker(worker);
          setIsDeferred(false);
        }
      };
      worker.addEventListener('statechange', onStateChange);
      cleanups.push(() => worker.removeEventListener('statechange', onStateChange));
    };

    const handleRegistration = (registration: ServiceWorkerRegistration) => {
      if (disposed) {
        return;
      }
      if (registration.waiting) {
        handleWorker(registration.waiting);
      }
      const onUpdateFound = () => {
        if (registration.waiting) {
          handleWorker(registration.waiting);
        }
      };
      registration.addEventListener('updatefound', onUpdateFound);
      cleanups.push(() => registration.removeEventListener('updatefound', onUpdateFound));
    };

    swcontainer.getRegistrations().then((registrations) => {
      if (disposed) {
        return;
      }
      registrations.forEach(handleRegistration);
    }).catch(() => {
      // Registration lookup failures are non-fatal for the banner.
    });

    const onControllerChange = () => {
      if (disposed) {
        return;
      }
      setWaitingWorker(null);
      setIsDeferred(false);
    };
    swcontainer.addEventListener('controllerchange', onControllerChange);

    return () => {
      disposed = true;
      swcontainer.removeEventListener('controllerchange', onControllerChange);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [container]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const deferUpdate = useCallback(() => {
    setIsDeferred(true);
  }, []);

  const showUpdate = useCallback(() => {
    setIsDeferred(false);
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!waitingWorker) {
      return;
    }
    if (isApplyBlocked?.()) {
      setError(new Error(blockedMessage ?? 'Save or close open forms before applying the update.'));
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await new Promise<void>(() => {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      });
      if (mountedRef.current) {
        setWaitingWorker(null);
        setIsDeferred(false);
        onUpdateApplied?.();
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          cause instanceof Error
            ? cause
            : new Error('Unable to apply the app update.'),
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsApplying(false);
      }
    }
  }, [waitingWorker, isApplyBlocked, blockedMessage, onUpdateApplied]);

  return {
    hasUpdate: Boolean(waitingWorker),
    isDeferred,
    isApplying,
    error,
    applyUpdate,
    deferUpdate,
    showUpdate,
    clearError,
  };
}
