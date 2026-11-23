import { useEffect, useRef, useState } from 'react';
import type { Announcement } from '../../hooks/useAnnouncement';

/**
 * AccessibilityAnnouncer — renders two visually hidden ARIA live regions
 * (one polite, one assertive) and announces dynamic content changes
 * (notifications, sync status, errors) to assistive technology.
 *
 * Announcements are delivered via the `petchain-announcement` custom event
 * dispatched by `useAnnouncement`, or by passing an `announcement` prop.
 */
export interface AccessibilityAnnouncerProps {
  /** Optional announcement to render directly (e.g. from a parent hook). */
  announcement?: Announcement | null;
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Errors and warnings are announced assertively; everything else politely. */
function isAssertive(severity: Announcement['severity']): boolean {
  return severity === 'error' || severity === 'warning';
}

export function AccessibilityAnnouncer({ announcement }: AccessibilityAnnouncerProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const lastIdRef = useRef<string | null>(null);

  const handleAnnouncement = (next: Announcement | null | undefined) => {
    if (!next || next.id === lastIdRef.current) {
      return;
    }
    lastIdRef.current = next.id;

    if (isAssertive(next.severity)) {
      setAssertiveMessage(next.message);
    } else {
      setPoliteMessage(next.message);
    }
  };

  // React to announcements dispatched through the shared hook.
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Announcement>).detail;
      handleAnnouncement(detail);
    };

    window.addEventListener('petchain-announcement', listener);
    return () => window.removeEventListener('petchain-announcement', listener);
  }, []);

  // React to announcements passed directly as a prop.
  useEffect(() => {
    handleAnnouncement(announcement);
  }, [announcement]);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={visuallyHidden}
        data-testid="accessibility-announcer-polite"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={visuallyHidden}
        data-testid="accessibility-announcer-assertive"
      >
        {assertiveMessage}
      </div>
    </>
  );
}

export default AccessibilityAnnouncer;
