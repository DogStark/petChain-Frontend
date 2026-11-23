import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseUnsavedChangesOptions {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /** Called when the user chooses to save from the confirmation dialog. */
  onSave?: () => void | Promise<void>;
  /** Called when the user chooses to discard changes. */
  onDiscard?: () => void;
  /** Message shown in the native beforeunload prompt. */
  message?: string;
}

export interface UseUnsavedChangesResult {
  /** True when the confirmation dialog should be visible. */
  isBlocked: boolean;
  /** Confirm saving and release the pending navigation. */
  confirmSave: () => Promise<void>;
  /** Discard changes and release the pending navigation. */
  confirmDiscard: () => void;
  /** Cancel the pending navigation and keep editing. */
  cancel: () => void;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Tracks unsaved form state and warns the user before leaving.
 *
 * - Browser back/forward, reload and tab close are guarded via `beforeunload`.
 * - In-app route changes are surfaced through `isBlocked` so a dialog can be
 *   rendered with Save / Discard options.
 */
export function useUnsavedChanges({
  isDirty,
  onSave,
  onDiscard,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesOptions): UseUnsavedChangesResult {
  const [isBlocked, setIsBlocked] = useState(false);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
    if (!isDirty) {
      setIsBlocked(false);
    }
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require returnValue to be set.
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  const confirmSave = useCallback(async () => {
    if (onSave) {
      await onSave();
    }
    setIsBlocked(false);
  }, [onSave]);

  const confirmDiscard = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    }
    setIsBlocked(false);
  }, [onDiscard]);

  const cancel = useCallback(() => {
    setIsBlocked(false);
  }, []);

  return { isBlocked, confirmSave, confirmDiscard, cancel };
}
