import { useEffect, useRef } from 'react';

export interface DraftRestorePromptProps {
  /** Whether a restorable draft exists for the current form. */
  open: boolean;
  /** Human-readable label for the form the draft belongs to. */
  formLabel?: string;
  /** When the draft was captured (epoch ms). */
  savedAt?: number;
  /** Called only when the user explicitly chooses to restore. */
  onRestore: () => void;
  /** Called when the user explicitly discards the draft. */
  onDiscard: () => void;
}

function formatSavedAt(savedAt?: number): string | null {
  if (!savedAt || !Number.isFinite(savedAt)) return null;
  try {
    return new Date(savedAt).toLocaleString();
  } catch {
    return null;
  }
}

/**
 * Opt-in restore prompt for form drafts.
 *
 * Drafts are NEVER applied automatically: the caller only restores state from
 * `onRestore`, which fires on an explicit user action. Dismissing the prompt
 * (Escape / backdrop) is treated as a discard so no draft is silently applied.
 */
export function DraftRestorePrompt({
  open,
  formLabel,
  savedAt,
  onRestore,
  onDiscard,
}: DraftRestorePromptProps) {
  const restoreRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDiscard();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onDiscard]);

  if (!open) return null;

  const savedLabel = formatSavedAt(savedAt);

  return (
    <div
      className="draft-restore-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-restore-title"
      aria-describedby="draft-restore-desc"
    >
      <div className="draft-restore-prompt__panel">
        <h2 id="draft-restore-title" className="draft-restore-prompt__title">
          Restore unsaved draft?
        </h2>
        <p id="draft-restore-desc" className="draft-restore-prompt__desc">
          {formLabel ? `An unsaved draft for ${formLabel} was found` : 'An unsaved draft was found'}
          {savedLabel ? `, saved ${savedLabel}` : ''}. Nothing is restored until you choose.
        </p>
        <div className="draft-restore-prompt__actions">
          <button
            ref={restoreRef}
            type="button"
            className="draft-restore-prompt__restore"
            onClick={onRestore}
          >
            Restore draft
          </button>
          <button
            type="button"
            className="draft-restore-prompt__discard"
            onClick={onDiscard}
          >
            Discard draft
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftRestorePrompt;
