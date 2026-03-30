import React, { useState } from 'react';
import Head from 'next/head';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/contexts/NotificationContext';
import { GetServerSideProps } from 'next';
import NotificationPreferencesPanel from '@/components/Notifications/NotificationPreferencesPanel';
import {
  AppNotification,
  NotificationCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '@/types/notification';

export const dynamic = 'force-dynamic';

const FILTERS: Array<{ value: NotificationCategory | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'APPOINTMENT', label: 'Appointments' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'MEDICATION', label: 'Medications' },
  { value: 'VACCINATION', label: 'Vaccinations' },
  { value: 'MESSAGE', label: 'Messages' },
  { value: 'MEDICAL_RECORD', label: 'Records' },
  { value: 'SYSTEM', label: 'System' },
];

function NotifCard({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const timeAgo = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });
  const icon = CATEGORY_ICONS[n.category as NotificationCategory] ?? '🔔';

  const priorityBadge: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    normal: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-500',
  };

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors cursor-pointer
        ${n.isRead ? 'bg-white border-gray-100 hover:bg-gray-50' : 'bg-blue-50 border-blue-100 hover:bg-blue-50/80'}`}
      onClick={() => !n.isRead && onRead(n.id)}
      role="article"
    >
      <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
        {icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p
            className={`text-sm leading-snug ${n.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}
          >
            {n.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityBadge[n.priority] ?? priorityBadge.normal}`}
            >
              {n.priority}
            </span>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-1">{n.message}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[n.category as NotificationCategory] ?? n.category}
          </span>
          {n.actionUrl && (
            <a
              href={n.actionUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              View details →
            </a>
          )}
          {!n.isRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead(n.id);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      {!n.isRead && (
        <span
          className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5"
          aria-label="Unread"
        />
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const {
    filteredNotifications,
    unreadCount,
    activeFilter,
    setFilter,
    markRead,
    markAllRead,
    isLoading,
    isConnected,
  } = useNotifications();

  const [tab, setTab] = useState<'notifications' | 'preferences'>('notifications');

  return (
    <>
      <Head>
        <title>Notifications | PetChain</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <div className="flex items-center gap-2 mt-1">
                {unreadCount > 0 && (
                  <span className="text-sm text-gray-500">{unreadCount} unread</span>
                )}
                <span
                  className={`flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-gray-400'}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            {unreadCount > 0 && tab === 'notifications' && (
              <button
                onClick={markAllRead}
                className="text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors px-3 py-2 rounded-xl hover:bg-blue-50 min-h-[44px]"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
            {(['notifications', 'preferences'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all capitalize min-h-[44px]
                  ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'notifications' && (
            <>
              {/* Category filters */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    aria-pressed={activeFilter === f.value}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px]
                      ${
                        activeFilter === f.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List */}
              {isLoading && filteredNotifications.length === 0 ? (
                <div className="flex justify-center py-16">
                  <svg
                    className="w-8 h-8 animate-spin text-blue-500"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <span className="text-5xl">🔔</span>
                  <p className="text-lg font-semibold text-gray-700">All caught up!</p>
                  <p className="text-sm text-gray-400">No notifications in this category.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifications.map((n) => (
                    <NotifCard key={n.id} n={n} onRead={markRead} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'preferences' && <NotificationPreferencesPanel />}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
