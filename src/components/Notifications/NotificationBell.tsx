import { useNotifications } from '@/contexts/NotificationContext';

export default function NotificationBell({ className = '' }: { className?: string }) {
  const { unreadCount, toggleCenter, isConnected } = useNotifications();

  return (
    <button
      onClick={toggleCenter}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      className={`relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${className}`}
    >
      {/* Bell icon */}
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Live dot — green when WS connected */}
      <span
        aria-hidden="true"
        className={`absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`}
      />
    </button>
  );
}
