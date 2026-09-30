import "@/styles/globals.css";

import type { NextPage } from "next";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import Router, { useRouter } from "next/router";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import RouteProgressBar from "@/components/Navigation/RouteProgressBar";
import NotificationCenter from "@/components/Notifications/NotificationCenter";
import ToastContainer from "@/components/Notifications/ToastContainer";
import RouteErrorBoundaryWithRouter from "@/components/ErrorHandling/RouteErrorBoundary";
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
import RouteMetadata from "@/components/RouteMetadata";
import AccessibilityAnnouncer from "@/components/Accessibility/AccessibilityAnnouncer";
import { useWebVitals } from "@/hooks/useWebVitals";
import { buildReport, sendToAnalytics, sendToGoogleAnalytics, getRating } from "@/lib/webVitalsReporter";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const SW_REGISTRATION_KEY = "sw-registered";

/**
 * Browser-only initialization. Safe no-op on the server so that SSR and
 * `next build` never touch `window`, `navigator`, or service workers.
 */
function initBrowserCapabilities(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Register the service worker once per browser session.
  if ("serviceWorker" in navigator) {
    try {
      if (window.sessionStorage.getItem(SW_REGISTRATION_KEY) !== "true") {
        window.sessionStorage.setItem(SW_REGISTRATION_KEY, "true");
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
    } catch {
      // sessionStorage may be unavailable (private mode); skip registration.
    }
  }
}

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
  const router = useRouter();

  // Browser-only initialization runs once, after mount, on the client only.
  useEffect(() => {
    initBrowserCapabilities();
  }, []);

  // Global Pageview Analytics Event Tracker (client-only, consent-gated).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleRouteChange = (url: string) => {
      // Analytics must not emit before consent is known.
      const consent =
        typeof window.localStorage !== "undefined"
          ? window.localStorage.getItem("analytics-consent")
          : null;
      if (consent !== "granted") {
        return;
      }

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
          <RouteErrorBoundaryWithRouter>
            <PWAManager />
            {/* Custom high-performance route transition feedback */}
            <RouteProgressBar />
            {/* Global toast queue */}
            <ToastContainer />
            {/* Slide-in notification center */}
            <NotificationCenter />
            {/* Live-region announcements for assistive technology */}
            <AccessibilityAnnouncer />
            {getLayout(<Component {...pageProps} />)}
            <RouteMetadata pathname={router.pathname} asPath={router.asPath} />
          </RouteErrorBoundaryWithRouter>
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
