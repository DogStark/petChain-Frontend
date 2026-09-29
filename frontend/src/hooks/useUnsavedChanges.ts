import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks dirty state for a single form section and guards against losing
 * unsaved consent/permission edits through navigation.
 *
 * - Dirty state is tracked per hook instance (one per form section).
 * - Dirty state is reset only after a confirmed server success via `markSaved`.
 * - A `beforeunload` handler warns on tab close / refresh / browser back.
 * - `confirmNavigation` lets in-app route guards warn without blocking safe
 *   programmatic redirects (callers can bypass by not invoking the guard).
 * - Failed saves keep edits intact; `runSave` prevents duplicate in-flight
 *   requests while a save is pending.
 */
export interface UseUnsavedChangesOptions {
  /** Optional message used for the native beforeunload prompt. */
  message?: string;
}

export interface UseUnsavedChangesResult {
  /** True when the section has edits that have not been confirmed saved. */
  isDirty: boolean;
  /** True while a save request is in flight. */
  isSaving: boolean;
  /** Mark the section dirty (call on any user edit). */
  markDirty: () => void;
  /** Reset dirty state after a confirmed server success. */
  markSaved: () => void;
  /**
   * Run a save function, guarding against duplicate in-flight requests.
   * Resolves with the save result on success and resets dirty state only
   * after the server confirms success. On failure, edits are preserved.
   */
  runSave: <T>(save: () => Promise<T>) => Promise<T | undefined>;
  /**
   * Returns true when navigation is safe (not dirty) or the user confirms
   * discarding edits. Safe programmatic redirects should skip this guard.
   */
  confirmNavigation: () => boolean;
}

const DEFAULT_MESSAGE =
  'You have unsaved changes. Are you sure you want to leave this page?';

export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {},
): UseUnsavedChangesResult {
  const { message = DEFAULT_MESSAGE } = options;
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setIsDirty(next);
  }, []);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      setDirty(true);
    }
  }, [setDirty]);

  const markSaved = useCallback(() => {
    setDirty(false);
  }, [setDirty]);

  const runSave = useCallback(
    async <T,>(save: () => Promise<T>): Promise<T | undefined> => {
      if (savingRef.current) {
        // Prevent duplicate in-flight requests; keep existing edits intact.
        return undefined;
      }
      savingRef.current = true;
      setIsSaving(true);
      try {
        const result = await save();
        // Reset dirty state only after confirmed server success.
        setDirty(false);
        return result;
      } catch (error) {
        // Preserve edits on failure so the user can retry.
        throw error;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [setDirty],
  );

  const confirmNavigation = useCallback(() => {
    if (!dirtyRef.current) {
      return true;
    }
    if (typeof window === 'undefined') {
      return true;
    }
    return window.confirm(message);
  }, [message]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) {
        return undefined;
      }
      event.preventDefault();
      // Legacy browsers require returnValue to be set to show the prompt.
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);

  return {
    isDirty,
    isSaving,
    markDirty,
    markSaved,
    runSave,
    confirmNavigation,
  };
}

export default useUnsavedChanges;
