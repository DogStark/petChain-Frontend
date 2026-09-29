import { useCallback, useRef } from 'react';

/** Severity drives the aria-live politeness level of the announcement. */
export type AnnouncementSeverity = 'success' | 'error' | 'warning' | 'info';

export interface Announcement {
  id: string;
  message: string;
  severity: AnnouncementSeverity;
}

const DEDUPE_WINDOW_MS = 5000;
const MAX_ANNOUNCEMENTS = 20;

/**
 * useAnnouncement — a shared hook for announcing asynchronous mutation
 * results to assistive technology via an ARIA live region.
 *
 * Features:
 *  - Deduplication: identical messages within a 5-second window are suppressed.
 *  - Severity semantics: success/error/warning/info map to aria-live values.
 *  - Sensitive-value exclusion: callers must pass a sanitized message; the
 *    hook does not strip values itself (the caller is responsible).
 *  - Bounded history: only the last 20 announcements are kept.
 */
export function useAnnouncement() {
  const announcementsRef = useRef<Announcement[]>([]);
  const lastMessageRef = useRef<string>('');
  const lastMessageTimeRef = useRef<number>(0);

  const announce = useCallback(
    (message: string, severity: AnnouncementSeverity = 'info') => {
      // Deduplication: suppress identical messages within the dedupe window.
      const now = Date.now();
      if (message === lastMessageRef.current && now - lastMessageTimeRef.current < DEDUPE_WINDOW_MS) {
        return;
      }
      lastMessageRef.current = message;
      lastMessageTimeRef.current = now;

      const announcement: Announcement = {
        id: `announcement-${now}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        severity,
      };

      announcementsRef.current = [announcement, ...announcementsRef.current].slice(
        0,
        MAX_ANNOUNCEMENTS,
      );

      // Dispatch a custom event so the announcer component can react.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<Announcement>('petchain-announcement', { detail: announcement }),
        );
      }
    },
    [],
  );

  const clearAnnouncements = useCallback(() => {
    announcementsRef.current = [];
  }, []);

  return { announce, clearAnnouncements, announcements: announcementsRef.current };
}
