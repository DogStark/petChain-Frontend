import { useEffect, useRef } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export interface UnsavedFormGuardProps {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /** Called when the user chooses to save from the confirmation dialog. */
  onSave?: () => void | Promise<void>;
  /** Called when the user chooses to discard changes. */
  onDiscard?: () => void;
  /** Optional custom dialog title. */
  title?: string;
  /** Optional custom dialog description. */
  description?: string;
}

/**
 * Renders an accessible confirmation dialog when the user attempts to leave a
 * form with unsaved changes. Browser back/forward and reload are guarded via
 * the `useUnsavedChanges` hook.
 */
export function UnsavedFormGuard({
  isDirty,
  onSave,
  onDiscard,
  title = 'Unsaved changes',
  description = 'You have unsaved changes. Do you want to save before leaving?',
}: UnsavedFormGuardProps) {
  const { isBlocked, confirmSave, confirmDiscard, cancel } = useUnsavedChanges({
    isDirty,
    onSave,
    onDiscard,
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isBlocked) {
      return;
    }

    saveButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBlocked, cancel]);

  if (!isBlocked) {
    return null;
  }

  return (
    <div
      className="unsaved-form-guard__overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          cancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="unsaved-form-guard"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-form-guard-title"
        aria-describedby="unsaved-form-guard-description"
      >
        <h2 id="unsaved-form-guard-title" className="unsaved-form-guard__title">
          {title}
        </h2>
        <p id="unsaved-form-guard-description" className="unsaved-form-guard__description">
          {description}
        </p>
        <div className="unsaved-form-guard__actions">
          <button
            type="button"
            className="unsaved-form-guard__button unsaved-form-guard__button--secondary"
            onClick={cancel}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="unsaved-form-guard__button unsaved-form-guard__button--danger"
            onClick={confirmDiscard}
          >
            Discard
          </button>
          <button
            ref={saveButtonRef}
            type="button"
            className="unsaved-form-guard__button unsaved-form-guard__button--primary"
            onClick={() => {
              void confirmSave();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedFormGuard;
