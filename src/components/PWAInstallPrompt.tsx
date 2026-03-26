import Image from 'next/image';

interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  return (
    <div
      role="dialog"
      aria-label="Install PetChain app"
      className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 flex items-center gap-3 animate-slide-up"
    >
      <Image
        src="/PETCHAIN.jpeg"
        alt="PetChain"
        width={48}
        height={48}
        className="rounded-xl flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">Install PetChain</p>
        <p className="text-xs text-gray-500 truncate">Add to home screen for offline access</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg transition-colors"
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
        <button
          onClick={onInstall}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
}

interface PWAUpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function PWAUpdateBanner({ onUpdate, onDismiss }: PWAUpdateBannerProps) {
  return (
    <div
      role="alert"
      className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto bg-blue-600 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3"
    >
      <span className="text-xl flex-shrink-0">≡ƒöä</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Update available</p>
        <p className="text-xs text-blue-100">A new version of PetChain is ready.</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded-lg transition-colors"
        >
          Later
        </button>
        <button
          onClick={onUpdate}
          className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}

interface OfflineBannerProps {
  isOffline: boolean;
}

export function OfflineBanner({ isOffline }: OfflineBannerProps) {
  if (!isOffline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-2 px-4 font-medium"
    >
      ≡ƒôí You&apos;re offline ΓÇö showing cached data
    </div>
  );
}
