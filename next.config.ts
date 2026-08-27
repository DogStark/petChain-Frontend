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
};

export default withBundleAnalyzer(nextConfig);
