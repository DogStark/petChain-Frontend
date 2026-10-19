import type { NextPageContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import {
  redactCorrelationId,
  recordErrorDiagnostic,
  CORRELATION_HEADER,
  type RouteGroup,
} from '@/lib/errorCorrelation';

interface ErrorPageProps {
  statusCode: number;
  correlationId: string;
  routeGroup: RouteGroup;
  /** Path-only URL of the failed request, used for the no-JS reload link. */
  currentPath: string;
}

const STATUS_TITLES: Record<number, string> = {
  404: 'Page not found',
  500: 'Something went wrong',
};

function classifyPath(path: string | undefined): RouteGroup {
  if (!path) return 'public';
  const protectedPrefixes = [
    '/dashboard',
    '/wallet',
    '/pets',
    '/admin',
    '/sessions',
    '/account-settings',
    '/profile',
    '/appointments',
    '/scan',
  ];
  return protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`))
    ? 'protected'
    : 'public';
}

/**
 * Global error page (Pages Router `_error`).
 *
 * Rendered on the server for uncaught SSR errors and HTTP status codes, so it
 * works with JavaScript disabled — the correlation ID is baked into the HTML.
 * Only coarse route group and status are retained; nothing about the URL,
 * query, account, wallet, pet, or health data is recorded or displayed.
 */
function ErrorPage({ statusCode, correlationId, routeGroup, currentPath }: ErrorPageProps) {
  const title = STATUS_TITLES[statusCode] ?? 'Something went wrong';
  const isNotFound = statusCode === 404;

  return (
    <>
      <Head>
        <title>{`${statusCode} — ${title} — PetChain`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
        data-testid={`error-page-${statusCode}`}
        data-route-group={routeGroup}
      >
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
          <p className="text-4xl font-extrabold text-blue-700 mb-2">{statusCode}</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2" tabIndex={-1}>
            {title}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {isNotFound
              ? 'The page you are looking for does not exist or has moved.'
              : 'An unexpected error occurred. You can retry or come back later.'}
          </p>

          <div className="flex flex-col gap-3">
            {isNotFound ? (
              <Link
                href="/"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to homepage
              </Link>
            ) : (
              <Link
                href="/"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to safety
              </Link>
            )}
            <a
              href={currentPath}
              className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Reload this page
            </a>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Reference: <code className="font-mono select-all">{correlationId}</code>
          </p>
        </div>
      </div>
    </>
  );
}

function extractPath(url: string | undefined): string {
  if (!url) return '/';
  // Strip query and hash: the reload link should be a plain navigable path,
  // and query strings can carry data we don't want echoed into markup.
  const path = url.split(/[?#]/, 1)[0];
  return path.startsWith('/') ? path : `/${path}`;
}

ErrorPage.getInitialProps = ({ res, err, req }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  const currentPath = extractPath(req?.url);
  const routeGroup = classifyPath(currentPath);

  // Header set by upstream layers (API/proxy) wins; otherwise generate here.
  // Redaction is enforced either way — a tainted header value is discarded.
  const headerId = typeof req !== 'undefined' ? req.headers?.[CORRELATION_HEADER.toLowerCase()] : undefined;
  const headerValue = Array.isArray(headerId) ? headerId[0] : headerId;
  const correlationId = redactCorrelationId(
    typeof headerValue === 'string' ? headerValue : undefined,
    routeGroup,
  );

  if (typeof window === 'undefined') {
    recordErrorDiagnostic({
      correlationId,
      routeGroup,
      errorKind: statusCode === 404 ? 'HttpNotFound' : 'HttpServerError',
      status: statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  return { statusCode, correlationId, routeGroup, currentPath } as ErrorPageProps;
};

export default ErrorPage;
