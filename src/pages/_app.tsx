import "@/styles/globals.css";
import type { AppProps } from "next/app";
import type { NextWebVitalsMetric } from "next/app";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
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

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

/** Report Core Web Vitals to console (can be wired to analytics later) */
export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms`);
  }
}
