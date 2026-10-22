import { useCallback, useEffect, useRef, useState } from 'react';

export type UpdateDeferralStatus = 'idle' | 'waiting' | 'applying' | 'error';

export interface UpdateDeferralOptions {
  /** The waiting service worker, if one is available. */
  waitingWorker?: ServiceWorker | null;
  /** Called when the user chooses to apply the update. */
  onApply?: () => Promise<void> | void;
  /** Called when the user defers the update. */
  onDefer?: () => void;
  /** Optional guard that returns true when it is unsafe to apply an update. */
  isApplyBlocked?: () => boolean;
  /** Message shown when apply is blocked. */
  blockedMessage?: string;
}

export interface UpdateDeferralResult {
  status: UpdateDeferralStatus;
  isWaiting: boolean;
  isApplying: boolean;
  error: Error | null;
  blockedMessage: string | null;
  applyUpdate: () => Promise<void>;
  deferUpdate: () => void;
  clearError: () => void;
}

const DEFAULT_BLOCKED_MESSAGE =
  'The update cannot be applied right now. Save or close open forms and try again';

export function useUpdateDeferral(options: UpdateDeferralOptions = {}): UpdateDeferralResult {
  const { waitingWorker = null, onApply, onDefer, isApplyBlocked, blockedMessage } = options;

  const [status, setStatus] = useState<UpdateDeferralStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [blockedMessageState, setBlockedMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!waitingWorker) {
      setStatus('idle');
      return;
    }
    setStatus('waiting');
  }, [waitingWorker]);

  const clearError = useCallback(() => {
    setError(null);
    setBlockedMessage(null);
  }, []);

  const deferUpdate = useCallback(() => {
    clearError();
    onDefer?.();
  }, [clearError, onDefer]);

  const applyUpdate = useCallback(async () => {
    clearError();

    if (!waitingWorker) {
      setStatus('idle');
      return;
    }

    if (isApplyBlocked?.()) {
      setBlockedMessage(blockedMessage ?? DEFAULT_BLOCKED_MESSAGE);
      setStatus('waiting');
      return;
    }

    setStatus('applying');
    try {
      if (onApply) {
        await onApply();
      } else {
        await applyWaitingWorker(waitingWorker);
      }
      if (mountedRef.current) {
        setStatus('idle');
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          cause instanceof Error
            ? cause
            : new Error('Unable to apply the app update.'),
        );
        setStatus('waiting');
      }
    }
  }, [
    clearError,
    waitingWorker,
    isApplyBlocked,
    blockedMessage,
    onApply,
  ]);

  return {
    status,
    isWaiting: status === 'waiting',
    isApplying: status === 'applying',
    error,
    blockedMessage: blockedMessageState,
    applyUpdate,
    deferUpdate,
    clearError,
  };
}

export async function applyWaitingWorker(worker: ServiceWorker): Promise<void> {
  await new Promise<void>(() => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}
