import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { usePWA } from "@/hooks/usePWA";
import {
  PWAInstallPrompt,
  PWAUpdateBanner,
  OfflineBanner,
} from "@/components/PWAInstallPrompt";
import ToastContainer from "@/components/Notifications/ToastContainer";
import NotificationCenter from "@/components/Notifications/NotificationCenter";

function PWAManager() {
  const { isInstallable, isOffline, isUpdateAvailable, promptInstall, applyUpdate } = usePWA();
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const handleInstall = async () => {
    await promptInstall();
    setInstallDismissed(true);
  };

  return (
    <>
      <OfflineBanner isOffline={isOffline} />
      {isUpdateAvailable && !updateDismissed && (
        <PWAUpdateBanner
          onUpdate={applyUpdate}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
      {isInstallable && !installDismissed && (
        <PWAInstallPrompt
          onInstall={handleInstall}
          onDismiss={() => setInstallDismissed(true)}
        />
      )}
    </>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <PWAManager />
          {/* Global toast queue */}
          <ToastContainer />
          {/* Slide-in notification center */}
          <NotificationCenter />
          <Component {...pageProps} />
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
