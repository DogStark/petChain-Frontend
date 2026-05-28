import React from 'react';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

const skipLinkClasses =
  'absolute left-4 top-4 z-50 -translate-y-4 opacity-0 transition-all duration-200 ease-out focus:translate-y-0 focus:opacity-100 focus:z-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 bg-slate-900 text-slate-100 px-3 py-2 rounded-md shadow-lg';

const handleSkipClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
  event.preventDefault();
  const target = document.querySelector(href) as HTMLElement | null;
  if (target) {
    target.tabIndex = -1;
    target.focus();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

export const SkipLinks: React.FC = () => {
  return (
    <nav aria-label="Skip links">
      <a
        href="#main-content"
        className={skipLinkClasses}
        onClick={handleSkipClick('#main-content')}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className={skipLinkClasses}
        onClick={handleSkipClick('#navigation')}
      >
        Skip to navigation
      </a>
      <a
        href="#footer"
        className={skipLinkClasses}
        onClick={handleSkipClick('#footer')}
      >
        Skip to footer
      </a>
    </nav>
  );
};
