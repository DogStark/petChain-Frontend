import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NetworkSwitcher } from './NetworkSwitcher';
import { announceToScreenReader, trapFocus, removeFocusTrap, generateId, getAriaLabel } from '../utils/accessibility';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const menuId = useRef(generateId('mobile-menu'));
  const closeButtonId = useRef(generateId('close-button'));

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-sky-400' : 'text-slate-300 hover:text-slate-100';
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        announceToScreenReader('Navigation menu closed');
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      // Set up focus trap when menu opens
      if (menuRef.current) {
        cleanupRef.current = trapFocus(menuRef.current);
      }

      // Announce to screen readers
      announceToScreenReader('Navigation menu opened');
    } else {
      document.body.style.overflow = 'unset';

      // Cleanup focus trap when menu closes
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [isOpen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
        data-testid="mobile-menu-backdrop"
      />

      {/* Mobile Menu */}
      <div
        ref={menuRef}
        className="fixed inset-y-0 left-0 w-full max-w-sm bg-slate-900 border-r border-slate-800 z-50 lg:hidden animate-slide-down"
        role="dialog"
        aria-modal="true"
        aria-labelledby={menuId.current}
        aria-label="Mobile navigation menu"
        data-testid="mobile-menu"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <Link
              to="/"
              className="text-xl font-semibold tracking-tight text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
              onClick={onClose}
              aria-label="Wata-Board home page"
            >
              Wata-Board
            </Link>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label={getAriaLabel('close-button')}
              id={closeButtonId.current}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4" role="navigation" aria-label="Main navigation">
            <div className="space-y-2" role="menu">
              <Link
                to="/"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/')}`}
                onClick={onClose}
                aria-current={location.pathname === '/' ? 'page' : undefined}
                role="menuitem"
              >
                Pay Bill
              </Link>
              <Link
                to="/about"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/about')}`}
                onClick={onClose}
                aria-current={location.pathname === '/about' ? 'page' : undefined}
                role="menuitem"
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/contact')}`}
                onClick={onClose}
                aria-current={location.pathname === '/contact' ? 'page' : undefined}
                role="menuitem"
              >
                Contact
              </Link>
              <Link
                to="/rate"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/rate')}`}
                onClick={onClose}
                aria-current={location.pathname === '/rate' ? 'page' : undefined}
                role="menuitem"
              >
                Rate Us
              </Link>
            </div>
          </nav>

          {/* Network Switcher */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center justify-center">
              <NetworkSwitcher showLabel={true} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
