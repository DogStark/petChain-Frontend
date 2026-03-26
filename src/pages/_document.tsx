import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1e3a8a" />

        {/* Apple PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PetChain" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.svg" />

        {/* Splash screen color for iOS */}
        <meta name="msapplication-TileColor" content="#1d4ed8" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.svg" />

        {/* Viewport for mobile */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Theme init script (prevents flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('petchain-theme');
                  var valid = ['light', 'dark', 'high-contrast'];
                  if (stored && valid.includes(stored)) {
                    document.documentElement.setAttribute('data-theme', stored);
                  } else {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var prefersHC = window.matchMedia('(prefers-contrast: more)').matches;
                    document.documentElement.setAttribute(
                      'data-theme',
                      prefersHC ? 'high-contrast' : prefersDark ? 'dark' : 'light'
                    );
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
