import "@/styles/globals.css";
import type { AppProps } from "next/app";
import type { NextWebVitalsMetric } from "next/app";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import Router from "next/router";
import type { NextPage } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { I18nProvider } from "@/i18n";
import { usePWA } from "@/hooks/usePWA";
import {
  PWAInstallPrompt,
  PWAUpdateBanner,
  OfflineBanner,
} from "@/components/PWAInstallPrompt";
import ToastContainer from "@/components/Notifications/ToastContainer";
import NotificationCenter from "@/components/Notifications/NotificationCenter";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteProgressBar from "@/components/Navigation/RouteProgressBar";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

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

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  // Register service worker on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("SW registration failed:", err);
        });
    }
  }, []);

  // Global Pageview Analytics Event Tracker
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // eslint-disable-next-line no-console
      console.log(`[Analytics] Pageview tracked for: ${url}`);
    };
    Router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      Router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

  // Use the layout defined at the page level, or fallback to returning the page directly
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <I18nProvider>
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ErrorBoundary>
            <PWAManager />
            {/* Custom high-performance route transition feedback */}
            <RouteProgressBar />
            {/* Global toast queue */}
            <ToastContainer />
            {/* Slide-in notification center */}
            <NotificationCenter />
            {getLayout(<Component {...pageProps} />)}
          </ErrorBoundary>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
    </I18nProvider>
  );
}

/** Report Core Web Vitals to console (can be wired to analytics later) */
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms`);
  }
}
