import React from 'react';
import { Link } from 'react-router-dom';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ href, children, className = '' }) => {
  return (
    <Link
      to={href}
      className={`skip-link ${className}`}
      onClick={(e) => {
        e.preventDefault();
        const target = document.querySelector(href) as HTMLElement;
        target?.focus();
        target?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {children}
    </Link>
  );
};

export const SkipLinks: React.FC = () => {
  return (
    <div className="sr-only">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#navigation">Skip to navigation</SkipLink>
      <SkipLink href="#payment-form">Skip to payment form</SkipLink>
    </div>
  );
};
