'use client';

import React, { useState, useCallback } from 'react';
import { checkUrlPolicy } from '@/lib/urlPolicy';
import ConfirmationDialog from './Wallet/ConfirmationDialog';

interface SafeExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  /** Text shown in the confirmation dialog when the destination is unknown. */
  confirmMessage?: string;
  /** Announced to screen readers when the link opens an external destination. */
  externalAnnouncement?: string;
}

/**
 * Wraps an <a> tag so that:
 * 1. Unknown origins are blocked or confirmed via a dialog.
 * 2. Sensitive query / hash parameters are stripped before navigation.
 * 3. External links are announced to assistive technology.
 */
export default function SafeExternalLink({
  href,
  children,
  confirmMessage = 'You are about to open an external link. Do you want to continue?',
  externalAnnouncement = ' (opens external link)',
  ...rest
}: SafeExternalLinkProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const policy = checkUrlPolicy(href);

      // Relative / same-origin / safe links pass through unchanged.
      if (policy.allowed && policy.cleanedHref === href) {
        return;
      }

      // Unknown origin — block and show confirmation.
      if (!policy.allowed) {
        e.preventDefault();
        setPendingHref(href);
        setDialogOpen(true);
        return;
      }

      // Known external origin — strip sensitive params and open normally.
      e.preventDefault();
      if (policy.cleanedHref) {
        window.open(policy.cleanedHref, '_blank', 'noopener,noreferrer');
      }
    },
    [href],
  );

  const handleConfirm = useCallback(() => {
    setDialogOpen(false);
    if (pendingHref) {
      const policy = checkUrlPolicy(pendingHref);
      if (policy.allowed && policy.cleanedHref) {
        window.open(policy.cleanedHref, '_blank', 'noopener,noreferrer');
      }
      setPendingHref(null);
    }
  }, [pendingHref]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingHref(null);
  }, []);

  const policy = checkUrlPolicy(href);
  const isExternal =
    policy.allowed &&
    !href.startsWith('/') &&
    !href.startsWith('#') &&
    !href.startsWith('?');

  return (
    <>
      <a
        href={policy.allowed ? policy.cleanedHref ?? href : '#'}
        target={isExternal ? '_blank' : rest.target}
        rel={isExternal ? 'noopener noreferrer' : rest.rel}
        onClick={handleClick}
        aria-label={
          isExternal
            ? rest['aria-label']
              ? `${rest['aria-label']} (opens external link)`
              : 'Opens external link'
            : rest['aria-label']
        }
        {...rest}
      >
        {children}
      </a>

      <ConfirmationDialog
        open={dialogOpen}
        title="External Link"
        description={confirmMessage}
        confirmLabel="Open Link"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant="warning"
      />
    </>
  );
}
