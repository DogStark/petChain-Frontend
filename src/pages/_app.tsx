import "@/styles/globals.css";

import type { AppProps, NextWebVitalsMetric } from "next/app";
import Router from "next/router";
import type { NextPage } from "next";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import RouteProgressBar from "@/components/Navigation/RouteProgressBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n";
import { usePWA } from "@/hooks/usePWA";
import {
  OfflineBanner,
  PWAInstallPrompt,
  PWAUpdateBanner,
} from "@/components/PWAInstallPrompt";
import ToastContainer from "@/components/Notifications/ToastContainer";
import NotificationCenter from "@/components/Notifications/NotificationCenter";
import { useWebVitals } from "@/hooks/useWebVitals";
import { buildReport, sendToAnalytics, sendToGoogleAnalytics, getRating } from "@/lib/webVitalsReporter";

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
  const { reports: _reports } = useWebVitals();

  // Register service worker on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("SW registered:", reg.scope);
          }
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("SW registration failed:", err);
          }
        });
    }
  }, []);

  // Global Pageview Analytics Event Tracker
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log(`[Analytics] Pageview tracked for: ${url}`);
      }
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

/** Report Core Web Vitals from Next.js built-in collection */
export function reportWebVitals(metric: NextWebVitalsMetric) {
  const m = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.value, metric.name),
    delta: metric.delta ?? metric.value,
    id: metric.id,
    navigationType: metric.navigationType ?? "navigate",
  };

  const report = buildReport(m);
  sendToAnalytics(report);
  sendToGoogleAnalytics(report);
}
