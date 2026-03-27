import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Corrected from ignoreBuilds to ignoreBuildErrors
    ignoreBuildErrors: true,
  },
};

export default withBundleAnalyzer(nextConfig);
