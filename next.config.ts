import type { NextConfig } from "next";
import { REMOTE_IMAGE_HOSTS } from "./src/lib/images/remoteImageHosts";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

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
    // Allowed origins for CSP — extend as needed for your deployment.
    // gstatic.com is required for Firebase compat SDK via importScripts in the SW.
    const csp = [
      "default-src 'self'",
      // Scripts: self + inline Next.js bootstrap + Firebase SDK from gstatic CDN
      "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
      // Styles: self + inline (Next.js inlines critical CSS)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs (for SVG inlining)
      "img-src 'self' data: blob:",
      // Fonts: self + gstatic for Firebase web fonts if ever used
      "font-src 'self' https://fonts.gstatic.com",
      // Connect: self + Stellar Horizon + Soroban RPC + Firebase FCM
      "connect-src 'self' https://horizon-testnet.stellar.org https://horizon.stellar.org https://soroban-testnet.stellar.org https://soroban.stellar.org https://fcm.googleapis.com",
      // Workers: self (SW must be same-origin)
      "worker-src 'self'",
      // Frames: none
      "frame-src 'none'",
      // Objects: none
      "object-src 'none'",
      // Base URI: self
      "base-uri 'self'",
      // Form action: self
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
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
