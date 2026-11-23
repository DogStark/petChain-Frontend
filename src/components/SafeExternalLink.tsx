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
 * 1. External destinations show a warning dialog before navigating away.
 * 2. Unknown origins are blocked or confirmed via a dialog.
 * 3. Sensitive query / hash parameters are stripped before navigation.
 * 4. External links are announced to assistive technology.
 */
export default function SafeExternalLink({
  href,
  children,
  confirmMessage = 'You are about to leave the app and open an external link. Do you want to continue?',
  externalAnnouncement = ' (opens external link)',
  ...rest
}: SafeExternalLinkProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const policy = checkUrlPolicy(href);
  const isExternal =
    policy.allowed &&
    !href.startsWith('/') &&
    !href.startsWith('#') &&
    !href.startsWith('?');

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const currentPolicy = checkUrlPolicy(href);

      // Relative / same-origin / safe links pass through unchanged.
      if (currentPolicy.allowed && !isExternal) {
        return;
      }

      // External or unknown origin — intercept and show the warning dialog.
      e.preventDefault();
      setPendingHref(href);
      setDialogOpen(true);
    },
    [href, isExternal],
  );

  const handleConfirm = useCallback(() => {
    setDialogOpen(false);
    if (pendingHref) {
      const pendingPolicy = checkUrlPolicy(pendingHref);
      if (pendingPolicy.allowed && pendingPolicy.cleanedHref) {
        window.open(pendingPolicy.cleanedHref, '_blank', 'noopener,noreferrer');
      }
      setPendingHref(null);
    }
  }, [pendingHref]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingHref(null);
  }, []);

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
              ? `${rest['aria-label']}${externalAnnouncement}`
              : `Opens external link${externalAnnouncement}`
            : rest['aria-label']
        }
        {...rest}
      >
        {children}
      </a>

      <ConfirmationDialog
        open={dialogOpen}
        title="Leaving this app"
        description={
          <>
            <span>{confirmMessage}</span>
            {pendingHref && (
              <span className="mt-2 block break-all text-sm font-mono text-gray-600">
                {pendingHref}
              </span>
            )}
          </>
        }
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant="warning"
      />
    </>
  );
}
