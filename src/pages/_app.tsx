import "@/styles/globals.css";

import type { NextPage } from "next";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import Router, { useRouter } from "next/router";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import RouteProgressBar from "@/components/Navigation/RouteProgressBar";
import BottomNav from "@/components/Navigation/BottomNav";
import NotificationCenter from "@/components/Notifications/NotificationCenter";
import ToastContainer from "@/components/Notifications/ToastContainer";
import RouteErrorBoundaryWithRouter from "@/components/ErrorHandling/RouteErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DataModeProvider } from "@/contexts/DataModeContext";
import { I18nProvider } from "@/i18n";
import { usePWA } from "@/hooks/usePWA";
import {
  OfflineBanner,
  PWAInstallGate,
  PWAUpdateBanner,
} from "@/components/PWAInstallPrompt";
import RouteMetadata from "@/components/RouteMetadata";
import AccessibilityAnnouncer from "@/components/Accessibility/AccessibilityAnnouncer";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import { useWebVitals } from "@/hooks/useWebVitals";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { buildReport, sendToAnalytics, sendToGoogleAnalytics, getRating } from "@/lib/webVitalsReporter";

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const SW_REGISTRATION_KEY = "sw-registered";
const PUSH_PROMPT_PREFIX = "push-notification-prompted";
const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

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
  const [updateDismissed, setUpdateDismissed] = useState(false);

  return (
    <>
      <OfflineBanner isOffline={isOffline} />
      {isUpdateAvailable && !updateDismissed && (
        <PWAUpdateBanner
          onUpdate={applyUpdate}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
      <PWAInstallGate isInstallable={isInstallable} onInstall={promptInstall} />
    </>
  );
}

function FirstLoginPushPrompt() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { permission, loading, error, requestPermission } = usePushNotifications(
    user?.id ?? null,
    FIREBASE_VAPID_KEY,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      void requestPermission();
      return;
    }

    const storageKey = `${PUSH_PROMPT_PREFIX}:${user.id}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "shown");
    } catch (storageError) {
      console.warn("Unable to persist the push notification prompt state:", storageError);
    }

    if (Notification.permission === "default") setVisible(true);
  }, [isAuthenticated, isLoading, requestPermission, user]);

  useEffect(() => {
    if (permission.granted || permission.denied) setVisible(false);
  }, [permission.denied, permission.granted]);

  const handleEnable = async () => {
    await requestPermission();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission !== "default"
    ) {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="push-prompt-title"
      aria-describedby="push-prompt-description"
      className="fixed bottom-4 right-4 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-blue-100 bg-white p-5 shadow-xl"
    >
      <h2 id="push-prompt-title" className="text-lg font-bold text-gray-900">
        Stay up to date with your pet&apos;s care
      </h2>
      <p id="push-prompt-description" className="mt-2 text-sm text-gray-600">
        Push notifications can remind you about vaccinations and appointments, and alert you to
        important pet health updates. You can change this permission in your browser settings.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => void handleEnable()}
          disabled={loading}
          className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loading ? "Enabling…" : "Enable notifications"}
        </button>
      </div>
    </aside>
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
      <FirstLoginPushPrompt />
      <ThemeProvider>
        <DataModeProvider>
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
              <KeyboardShortcutsHelp />
              {getLayout(<Component {...pageProps} />)}
              {/* Mobile-only bottom navigation */}
              <BottomNav />
              <RouteMetadata pathname={router.pathname} asPath={router.asPath} />
            </RouteErrorBoundaryWithRouter>
          </NotificationProvider>
        </DataModeProvider>
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
