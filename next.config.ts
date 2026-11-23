import type { NextConfig } from "next";
import { REMOTE_IMAGE_HOSTS } from "./src/lib/images/remoteImageHosts";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// Least-privilege Content Security Policy.
//
// Required origins (documented in SECURITY.md):
// - https://www.gstatic.com: Firebase compat SDK loaded via importScripts in the SW.
// - https://fonts.gstatic.com: Firebase web fonts (font-src only).
// - Stellar Horizon (testnet + mainnet) and Soroban RPC (testnet + mainnet):
//   wallet balance, transaction submission, and contract calls (connect-src).
// - https://fcm.googleapis.com: Firebase Cloud Messaging push (connect-src).
//
// PWA: the service worker is same-origin, so worker-src 'self' and
// manifest-src 'self' are sufficient. No wildcard (*) sources are used.
// Extend the arrays below when adding new trusted origins.
const CSP_SCRIPT_SRC = ["'self'", "'unsafe-inline'", "https://www.gstatic.com"];
const CSP_STYLE_SRC = ["'self'", "'unsafe-inline'"];
const CSP_IMG_SRC = ["'self'", "data:", "blob:"];
const CSP_FONT_SRC = ["'self'", "https://fonts.gstatic.com"];
const CSP_CONNECT_SRC = [
  "'self'",
  "https://horizon-testnet.stellar.org",
  "https://horizon.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://soroban.stellar.org",
  "https://fcm.googleapis.com",
];
const CSP_WORKER_SRC = ["'self'"];
const CSP_MANIFEST_SRC = ["'self'"];
const CSP_FRAME_SRC = ["'none'"];
const CSP_OBJECT_SRC = ["'none'"];
const CSP_BASE_URI = ["'self'"];
const CSP_FORM_ACTION = ["'self'"];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${CSP_SCRIPT_SRC.join(' ')}`,
  `style-src ${CSP_STYLE_SRC.join(' ')}`,
  `img-src ${CSP_IMG_SRC.join(' ')}`,
  `font-src ${CSP_FONT_SRC.join(' ')}`,
  `connect-src ${CSP_CONNECT_SRC.join(' ')}`,
  `worker-src ${CSP_WORKER_SRC.join(' ')}`,
  `manifest-src ${CSP_MANIFEST_SRC.join(' ')}`,
  `frame-src ${CSP_FRAME_SRC.join(' ')}`,
  `object-src ${CSP_OBJECT_SRC.join(' ')}`,
  `base-uri ${CSP_BASE_URI.join(' ')}`,
  `form-action ${CSP_FORM_ACTION.join(' ')}`,
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Corrected from ignoreBuilds to ignoreBuildErrors
    ignoreBuildErrors: true,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 50,
  },
  images: {
    remotePatterns: REMOTE_IMAGE_HOSTS,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
