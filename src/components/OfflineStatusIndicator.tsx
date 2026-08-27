import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineStatusIndicator() {
  const isOnline = useOnlineStatus();

  const label = isOnline ? 'Connected to internet' : 'No internet connection — some features may be unavailable';
  const tooltip = isOnline ? 'Online' : 'Offline';

  return (
    <div className="relative group" title={tooltip}>
      <span
        role="status"
        aria-label={label}
        aria-live="polite"
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          'transition-all duration-300',
          isOnline
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-red-50 border-red-300 text-red-700 animate-pulse',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'w-2 h-2 rounded-full',
            isOnline ? 'bg-green-500' : 'bg-red-500',
          ].join(' ')}
        />
        <span className="sr-only">{label}</span>
        <span aria-hidden="true">{isOnline ? 'Online' : 'Offline'}</span>
      </span>
    </div>
  );
}
