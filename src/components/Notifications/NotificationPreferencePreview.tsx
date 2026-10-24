import React from 'react';
import { Bell } from 'lucide-react';
import { NotificationPreferences } from '@/types/notification';
import { buildNotificationPreview } from '@/utils/notificationPreview';

interface NotificationPreferencePreviewProps {
  /** The owner's current (not-yet-saved) notification preferences. */
  preferences: NotificationPreferences;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
}

/**
 * Renders an accessible preview of exactly what the owner will receive given the
 * current selections — the channels a message travels on and the event
 * categories that trigger delivery — before they hit "Save".
 *
 * Keyboard / screen-reader friendly: a labelled <section>, real <ul> lists, a
 * live `role="status"` summary, and status text that does not rely on colour
 * alone. It only reflects local preference selections; the backend keeps
 * ownership of authorization and consent.
 */
export function NotificationPreferencePreview({
  preferences,
  id,
}: NotificationPreferencePreviewProps) {
  const preview = buildNotificationPreview(preferences);
  const enabledChannels = preview.channels.filter((c) => c.enabled);

  return (
    <section
      id={id}
      aria-label="Notification delivery preview"
      className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
        <Bell size={16} className="text-blue-600" aria-hidden="true" />
        Preview before you save
      </h2>
      <p className="text-xs text-gray-500 mt-1" role="status">
        {preview.deliverySummary}
      </p>

      {preview.isEmpty ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
          Turn on at least one event type below to start receiving notifications.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Channels
            </h3>
            <ul role="list" className="mt-2 space-y-1">
              {enabledChannels.map((c) => (
                <li key={c.key} className="text-sm text-gray-800">
                  <span className="font-medium">{c.label}:</span>{' '}
                  <span className="text-gray-600">{c.sample}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              You&apos;ll be notified about
            </h3>
            <ul role="list" className="mt-2 space-y-1">
              {preview.categories.map((cat) => (
                <li key={cat.key} className="text-sm text-gray-800">
                  {cat.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export default NotificationPreferencePreview;
