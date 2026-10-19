/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Public emergency profiles: never index, never leak referrer, never cache.
        source: '/emergency/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, noarchive, nosnippet, nofollow',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      {
        // Emergency profile detail routes (e.g. /p/:id) opened from QR codes.
        source: '/p/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, noarchive, nosnippet, nofollow',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
