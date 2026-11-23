import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Content Security Policy for the frontend.
 *
 * The policy is emitted as an HTTP response header from `next.config.ts`
 * (see `headers()`), which is the authoritative source. This module keeps a
 * single, non-duplicated `<meta http-equiv="Content-Security-Policy">` fallback
 * for static exports / environments where response headers are stripped.
 *
 * Required origins (least privilege, no wildcards):
 * - script-src: 'self' (Next.js bundles). 'unsafe-inline' is required by the
 *   Next.js runtime bootstrap; 'unsafe-eval' is only needed in development.
 * - style-src: 'self' 'unsafe-inline' + fonts.googleapis.com (Inter stylesheet).
 * - font-src: 'self' + fonts.gstatic.com (Inter font files).
 * - img-src: 'self' data: blob: (uploads/previews) + map tile origins.
 * - connect-src: 'self' + Stellar Horizon/Soroban RPC endpoints and wallet
 *   provider APIs used by the Stellar integration.
 * - frame-src: 'self' + Stellar wallet provider iframes (e.g. Freighter/Albedo).
 * - worker-src: 'self' blob: (PWA service worker + web workers).
 * - manifest-src: 'self' (PWA manifest).
 *
 * Extend origins here and in `next.config.ts` together; never add `*`.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "connect-src 'self' https://horizon.stellar.org https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://soroban.stellar.org",
  "frame-src 'self' https://albedo.link https://wallet.freighter.app",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Content Security Policy fallback (authoritative header set in next.config.ts) */}
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />

        {/* DNS Prefetch & Preconnect for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Load Inter font (modern, readable, optimized) */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#1d4ed8" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
