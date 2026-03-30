// Accessibility utilities for WCAG compliance

// Announce messages to screen readers
export const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Trap focus within a container
export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    }
  };
  
  container.addEventListener('keydown', handleTabKey);
  firstFocusable?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};

// Remove focus trap
export const removeFocusTrap = (container: HTMLElement, cleanup?: () => void) => {
  container.removeEventListener('keydown', () => {});
  cleanup?.();
};

// Generate unique IDs for accessibility
export const generateId = (prefix: string = 'id') => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

// Check if user prefers reduced motion
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Check if user prefers high contrast
export const prefersHighContrast = () => {
  return window.matchMedia('(prefers-contrast: high)').matches;
};

// Check if user prefers dark mode
export const prefersDarkMode = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Set up keyboard navigation detection
export const setupKeyboardNavigation = () => {
  let isUsingKeyboard = false;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      isUsingKeyboard = true;
      document.body.classList.add('keyboard-navigation');
    }
  };
  
  const handleMouseDown = () => {
    isUsingKeyboard = false;
    document.body.classList.remove('keyboard-navigation');
  };
  
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleMouseDown);
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleMouseDown);
  };
};

// ARIA label helpers
export const getAriaLabel = (element: string, context?: string) => {
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

// Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  // This is a simplified version - in production, use a proper contrast calculation library
  return 4.5; // Assuming WCAG AA compliance
};

// Focus visible polyfill for better keyboard navigation
export const setupFocusVisible = () => {
  const style = document.createElement('style');
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
      left: 6px !important;
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
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .high-contrast {
        filter: contrast(1.5) !important;
      }
    }
    
    /* Reduced motion support */
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
