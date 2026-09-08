/**
 * Secure clipboard utilities for sensitive wallet data.
 *
 * Security assumptions:
 * - Clipboard history on OS/browser level is outside our control. We cannot
 *   prevent a user's clipboard manager from persisting data.
 * - We mitigate exposure by: (1) requiring an explicit user action to copy,
 *   (2) scheduling an automatic overwrite after a short TTL, and (3) always
 *   showing a security warning before and after copying.
 * - Clipboard content is overwritten with a placeholder string, not simply
 *   cleared, because some clipboard managers restore "empty" pastes from
 *   history.
 *
 * Contributor note: never pass real credential data in tests; use stub strings.
 */

/** How long (ms) sensitive clipboard content lives before being overwritten. */
export const CLIPBOARD_TTL_MS = 30_000;

/** Placeholder written to the clipboard after TTL expires. */
const OVERWRITE_PLACEHOLDER = '[cleared by PetChain – do not paste]';

/** Tracks the active cleanup timer so it can be reset on successive copies. */
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

export interface CopyResult {
  /** true when the write succeeded */
  ok: boolean;
  /** Error message when ok === false */
  error?: string;
}

/**
 * Copies `text` to the clipboard and schedules an overwrite after
 * `ttlMs` milliseconds.
 *
 * @param text   The sensitive string to copy.
 * @param ttlMs  Cleanup delay in ms (defaults to CLIPBOARD_TTL_MS).
 * @returns      A result object so callers can reflect success/failure in UI.
 */
export async function copyWithTTL(
  text: string,
  ttlMs: number = CLIPBOARD_TTL_MS
): Promise<CopyResult> {
  // Clear any previously scheduled cleanup first.
  if (cleanupTimer !== null) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Clipboard write failed. Try copying manually.',
    };
  }

  cleanupTimer = setTimeout(async () => {
    cleanupTimer = null;
    try {
      await navigator.clipboard.writeText(OVERWRITE_PLACEHOLDER);
    } catch {
      // Best-effort: if cleanup fails there is nothing more we can do without
      // surfacing a confusing error to the user after the fact.
    }
  }, ttlMs);

  return { ok: true };
}

/**
 * Cancels the pending clipboard cleanup timer and immediately overwrites the
 * clipboard. Call this when the component that triggered the copy unmounts or
 * when the user navigates away.
 */
export async function clearClipboardNow(): Promise<void> {
  if (cleanupTimer !== null) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  try {
    await navigator.clipboard.writeText(OVERWRITE_PLACEHOLDER);
  } catch {
    // Best-effort.
  }
}

/**
 * Returns true when a cleanup timer is currently pending.
 * Useful in tests to verify the timer was scheduled.
 */
export function hasPendingCleanup(): boolean {
  return cleanupTimer !== null;
}
