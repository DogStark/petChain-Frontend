import { useNotifications } from '@/contexts/NotificationContext';
import Toast from './Toast';

/**
 * Renders the stacked toast queue — fixed to top-right on desktop,
 * top-center on mobile. Mount once in _app.tsx.
 */
export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
