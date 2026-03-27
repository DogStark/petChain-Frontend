import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NetworkSwitcher } from './NetworkSwitcher';
import MobileNavigation from './MobileNavigation';
import { announceToScreenReader, trapFocus, removeFocusTrap, generateId, getAriaLabel } from '../utils/accessibility';

export const ResponsiveNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const navigationId = useRef(generateId('navigation'));
  const menuButtonId = useRef(generateId('menu-button'));

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-sky-400' : 'text-slate-300 hover:text-slate-100';
  };

  const toggleMobileMenu = () => {
    const newOpenState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newOpenState);

    if (newOpenState) {
      announceToScreenReader('Navigation menu opened');
      // Focus trap when menu opens
      if (mobileMenuRef.current) {
        cleanupRef.current = trapFocus(mobileMenuRef.current);
      }
    } else {
      announceToScreenReader('Navigation menu closed');
      // Cleanup focus trap when menu closes
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      // Return focus to menu button
      menuButtonRef.current?.focus();
    }
  };

  const closeMobileMenu = () => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      announceToScreenReader('Navigation menu closed');

      // Cleanup focus trap when menu closes
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      // Return focus to menu button
      menuButtonRef.current?.focus();
    }
  };

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Cleanup focus trap on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <>
      <nav
        className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-40"
        role="navigation"
        aria-label="Main navigation"
        id={navigationId.current}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="text-xl font-semibold tracking-tight text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                aria-label="Wata-Board home page"
              >
                Wata-Board
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-8">
              <div className="flex items-center gap-6 text-sm" role="menubar">
                <Link
                  to="/"
                  className={`transition px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/')}`}
                  aria-current={location.pathname === '/' ? 'page' : undefined}
                  role="menuitem"
                >
                  Pay Bill
                </Link>
                <Link
                  to="/about"
                  className={`transition px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/about')}`}
                  aria-current={location.pathname === '/about' ? 'page' : undefined}
                  role="menuitem"
                >
                  About
                </Link>
                <Link
                  to="/contact"
                  className={`transition px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/contact')}`}
                  aria-current={location.pathname === '/contact' ? 'page' : undefined}
                  role="menuitem"
                >
                  Contact
                </Link>
                <Link
                  to="/rate"
                  className={`transition px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/rate')}`}
                  aria-current={location.pathname === '/rate' ? 'page' : undefined}
                  role="menuitem"
                >
                  Rate Us
                </Link>
              </div>
              <NetworkSwitcher showLabel={false} />
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center gap-3">
              <NetworkSwitcher showLabel={false} />
              <button
                ref={menuButtonRef}
                onClick={toggleMobileMenu}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label={getAriaLabel('menu-button')}
                aria-expanded={isMobileMenuOpen}
                aria-controls={navigationId.current}
                id={menuButtonId.current}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Tablet Navigation (hidden on mobile, shown on tablet) */}
          <div className="hidden md:flex lg:hidden py-3 border-t border-slate-800" role="menubar">
            <div className="flex items-center gap-4 text-sm w-full justify-center">
              <Link
                to="/"
                className={`transition px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/')}`}
                aria-current={location.pathname === '/' ? 'page' : undefined}
                role="menuitem"
              >
                Pay Bill
              </Link>
              <Link
                to="/about"
                className={`transition px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/about')}`}
                aria-current={location.pathname === '/about' ? 'page' : undefined}
                role="menuitem"
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`transition px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/contact')}`}
                aria-current={location.pathname === '/contact' ? 'page' : undefined}
                role="menuitem"
              >
                Contact
              </Link>
              <Link
                to="/rate"
                className={`transition px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive('/rate')}`}
                aria-current={location.pathname === '/rate' ? 'page' : undefined}
                role="menuitem"
              >
                Rate Us
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      <MobileNavigation isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </>
  );
};
