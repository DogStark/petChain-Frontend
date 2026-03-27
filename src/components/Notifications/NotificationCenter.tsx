import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  AppNotification,
  NotificationCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '@/types/notification';

// ─── Category filter tabs ─────────────────────────────────────────────────────
const FILTERS: Array<{ value: NotificationCategory | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'APPOINTMENT', label: 'Appointments' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'MEDICATION', label: 'Meds' },
  { value: 'MESSAGE', label: 'Messages' },
  { value: 'SYSTEM', label: 'System' },
];

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const timeAgo = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });
  const icon = CATEGORY_ICONS[n.category as NotificationCategory] ?? '🔔';

  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-400',
    normal: 'bg-blue-400',
    low: 'bg-gray-300',
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer group
        ${n.isRead ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50'}`}
      onClick={() => !n.isRead && onRead(n.id)}
      role="listitem"
    >
      {/* Category emoji icon */}
      <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
        {icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-snug ${n.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}
          >
            {n.title}
          </p>
          <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {CATEGORY_LABELS[n.category as NotificationCategory] ?? n.category}
          </span>
          {n.actionUrl && (
            <a
              href={n.actionUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-blue-600 font-semibold hover:underline"
            >
              View →
            </a>
          )}
        </div>
      </div>

      {/* Unread dot + priority */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-1">
        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />}
        <span
          className={`w-1.5 h-1.5 rounded-full ${priorityDot[n.priority] ?? 'bg-gray-300'}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function NotificationCenter() {
  const {
    isCenterOpen,
    toggleCenter,
    filteredNotifications,
    unreadCount,
    activeFilter,
    setFilter,
    markRead,
    markAllRead,
    isLoading,
  } = useNotifications();

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isCenterOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleCenter();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isCenterOpen, toggleCenter]);

  // Trap focus inside panel
  useEffect(() => {
    if (isCenterOpen) panelRef.current?.focus();
  }, [isCenterOpen]);

  if (!isCenterOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        aria-hidden="true"
        onClick={toggleCenter}
      />

      {/* Panel — slides in from right */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification center"
        tabIndex={-1}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col outline-none animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 font-semibold px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors min-h-[36px]"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={toggleCenter}
              aria-label="Close notification center"
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={activeFilter === f.value}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap
                ${
                  activeFilter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" role="list" aria-label="Notification list">
          {isLoading && filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm">Loading…</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400 px-6 text-center">
              <span className="text-4xl">🔔</span>
              <p className="text-sm font-medium text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((n) => (
                <NotifRow key={n.id} n={n} onRead={markRead} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3 shrink-0">
          <a
            href="/notifications"
            onClick={toggleCenter}
            className="block text-center text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors py-1"
          >
            View all notifications →
          </a>
        </div>
      </div>
    </>
  );
}
