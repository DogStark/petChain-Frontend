// Accessibility utilities for WCAG compliance

// ─── Screen reader announcements ──────────────────────────────────────────────

/**
 * Announce a message to screen readers via a temporary live region.
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  // Must be in the DOM before setting textContent for some screen readers
  document.body.appendChild(announcement);
  // Small delay ensures the live region is registered before the message is set
  setTimeout(() => {
    announcement.textContent = message;
  }, 50);
  // Remove after announcement has been read
  setTimeout(() => {
    if (document.body.contains(announcement)) {
      document.body.removeChild(announcement);
    }
  }, 1500);
};

// ─── Focus trap ───────────────────────────────────────────────────────────────

/**
 * Trap keyboard focus within a container element (for modals/dialogs).
 * Returns a cleanup function that removes the trap.
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const getFocusable = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
      (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none',
    );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  // Move focus into the container
  const firstFocusable = getFocusable()[0];
  firstFocusable?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Remove focus trap by calling the cleanup function returned by trapFocus.
 * The container parameter is kept for backwards compatibility but is no longer needed.
 */
export const removeFocusTrap = (_container: HTMLElement, cleanup?: () => void) => {
  cleanup?.();
};

// ─── Focus restoration ────────────────────────────────────────────────────────

/**
 * Save the currently focused element and return a function that restores focus to it.
 * Useful for restoring focus after a modal closes.
 */
export const saveFocus = (): (() => void) => {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  return () => {
    previouslyFocused?.focus();
  };
};

// ─── Unique ID generator ──────────────────────────────────────────────────────

let _idCounter = 0;

/**
 * Generate a unique, stable ID for ARIA label associations.
 * Uses an incrementing counter rather than Math.random() for predictability.
 */
export const generateId = (prefix = 'id'): string => {
  _idCounter += 1;
  return `${prefix}-${_idCounter}`;
};

// ─── Keyboard helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the keyboard event is an activation key (Enter or Space).
 * Use this to make custom interactive elements keyboard-accessible.
 */
export const isActivationKey = (e: KeyboardEvent): boolean =>
  e.key === 'Enter' || e.key === ' ';

/**
 * Call handler when Enter or Space is pressed — mirrors native button behaviour.
 */
export const onActivationKey =
  (handler: (e: KeyboardEvent) => void) =>
  (e: KeyboardEvent): void => {
    if (isActivationKey(e)) {
      e.preventDefault();
      handler(e);
    }
  };

// ─── Reduced motion ───────────────────────────────────────────────────────────

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const prefersHighContrast = (): boolean =>
  window.matchMedia('(prefers-contrast: high)').matches;

export const prefersDarkMode = (): boolean =>
  window.matchMedia('(prefers-color-scheme: dark)').matches;

// ─── Keyboard navigation detection ───────────────────────────────────────────

/**
 * Adds/removes a `keyboard-navigation` class on <body> so CSS can show
 * focus rings only when the user is navigating by keyboard.
 * Returns a cleanup function.
 */
export const setupKeyboardNavigation = (): (() => void) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  };

  const handleMouseDown = () => {
    document.body.classList.remove('keyboard-navigation');
  };

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleMouseDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleMouseDown);
  };
};

// ─── ARIA label helpers ───────────────────────────────────────────────────────

export const getAriaLabel = (element: string, context?: string): string => {
  const labels: Record<string, string> = {
    'pay-button': 'Submit payment for utility bill',
    'meter-input': 'Enter your utility meter number',
    'amount-input': 'Enter payment amount in XLM',
    'menu-button': 'Toggle navigation menu',
    'close-button': 'Close dialog or menu',
    'network-switcher': 'Switch between testnet and mainnet networks',
    'wallet-balance': 'Current wallet balance',
    'rate-limit': 'Rate limiting status and remaining requests',
    'fee-estimate': 'Transaction fee estimation details',
    'status-message': 'Application status and error messages',
  };

  const baseLabel = labels[element] || element;
  return context ? `${baseLabel}, ${context}` : baseLabel;
};

// ─── Focus visible / global styles ───────────────────────────────────────────

/**
 * Inject global accessibility styles (focus rings, sr-only, skip links).
 * Uses logical CSS properties so styles work correctly in RTL layouts.
 */
export const setupFocusVisible = (): void => {
  if (document.getElementById('a11y-styles')) return; // Avoid duplicate injection
  const style = document.createElement('style');
  style.id = 'a11y-styles';
  style.textContent = `
    .keyboard-navigation *:focus {
      outline: 2px solid #0ea5e9 !important;
      outline-offset: 2px !important;
    }

    .sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    .skip-link {
      position: absolute !important;
      top: -40px !important;
      inset-inline-start: 6px !important;
      background: #0ea5e9 !important;
      color: white !important;
      padding: 8px !important;
      text-decoration: none !important;
      border-radius: 4px !important;
      z-index: 100 !important;
      transition: top 0.3s !important;
    }

    .skip-link:focus {
      top: 6px !important;
    }

    @media (prefers-contrast: high) {
      .high-contrast { filter: contrast(1.5) !important; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  `;
  document.head.appendChild(style);
};
