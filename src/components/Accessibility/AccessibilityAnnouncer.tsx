import React, { useEffect, useRef, useState } from 'react';
import type { Announcement, AnnouncementSeverity } from '@/hooks/useAnnouncement';

interface AnnouncementEvent extends CustomEvent {
  detail: Announcement;
}

/**
 * AccessibilityAnnouncer — renders a visually hidden ARIA live region
 * that receives announcements dispatched by `useAnnouncement`.
 *
 * The component must be mounted once (e.g. in _app.tsx) so that
 * every mutation component can call `announce()` without needing
 * a direct parent-child relationship.
 *
 * Each announcement is rendered as a separate paragraph inside the
 * live region. Screen readers announce new paragraphs as they are
 * added. The `aria-live` attribute on the container controls the
 * politeness level.
 */
export default function AccessibilityAnnouncer() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const regionRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as AnnouncementEvent).detail as Announcement;
      setAnnouncements((prev) => [detail, ...prev].slice(0, 20));

      // Auto-expire announcements after 8 seconds so the live region
      // does not grow unboundedly.
      const timeout = setTimeout(() => {
        setAnnouncements((prev) => prev.filter((a) => a.id !== detail.id));
      }, 8000);
      timeoutsRef.current.push(timeout);
    };

    window.addEventListener('petchain-announcement', handler);
    return () => {
      window.removeEventListener('petchain-announcement', handler);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcements.map((a) => (
        <p key={a.id}>{a.message}</p>
      ))}
    </div>
  );
}
