import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  );
}

export interface UseFocusTrapOptions {
  /** Whether the trap is currently active (e.g. the modal/drawer is open). */
  active: boolean;
  /**
   * Called when Escape is pressed. Return `true` to allow the default
   * close/cancel behavior, or `false` to keep the overlay open (e.g. when a
   * destructive action requires explicit confirmation).
   */
  onEscape?: () => boolean | void;
  /** Element to focus when the trap activates. Defaults to the first focusable node. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element that should receive focus when the trap deactivates. Defaults to the previously focused element. */
  returnFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * Shared focus management for modal and drawer primitives.
 *
 * - Traps keyboard focus inside the container while active.
 * - Moves initial focus into the container on activation.
 * - Routes Escape through the destructive-action policy via `onEscape`.
 * - Restores focus to the triggering control on deactivation.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>({
  active,
  onEscape,
  initialFocusRef,
  returnFocusRef,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const focusInitial = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const target =
      initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  }, [initialFocusRef]);

  const restoreFocus = useCallback(() => {
    const target = returnFocusRef?.current ?? previouslyFocusedRef.current;
    if (target && typeof target.focus === 'function' && document.contains(target)) {
      target.focus({ preventScroll: true });
    }
  }, [returnFocusRef]);

  useEffect(() => {
    if (!active) return;

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Move focus into the overlay on the next frame so the container is mounted.
    const raf = requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (event.key === 'Escape') {
        const allowed = onEscape ? onEscape() : true;
        if (allowed !== false) {
          event.stopPropagation();
        } else {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const target = event.target as Node | null;
      if (target && !container.contains(target)) {
        focusInitial();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      restoreFocus();
    };
  }, [active, focusInitial, restoreFocus, onEscape]);

  return { containerRef, focusInitial, restoreFocus };
}

export default useFocusTrap;
