import type { NextConfig } from "next";

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

export default nextConfig;
