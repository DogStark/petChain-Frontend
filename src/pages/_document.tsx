import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
