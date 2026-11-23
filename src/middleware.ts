import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-route rate-limit budgets for public and expensive frontend API routes.
 * `limit` requests are allowed per `windowMs` for a given client identity.
 */
type RouteBudget = {
  limit: number;
  windowMs: number;
};

const ROUTE_BUDGETS: Array<{ pattern: RegExp; budget: RouteBudget }> = [
  // ZKP generation is CPU-heavy; keep the budget tight.
  { pattern: /^\/api\/zkp(\/|$)/, budget: { limit: 10, windowMs: 60_000 } },
  // Analytics export can be expensive to assemble.
  { pattern: /^\/api\/analytics\/export(\/|$)/, budget: { limit: 5, windowMs: 60_000 } },
  // Observability endpoints are public and cheap to spam.
  { pattern: /^\/api\/observability(\/|$)/, budget: { limit: 60, windowMs: 60_000 } },
  // Webhooks are public entry points.
  { pattern: /^\/api\/webhooks?(\/|$)/, budget: { limit: 30, windowMs: 60_000 } },
];

const DEFAULT_BUDGET: RouteBudget = { limit: 120, windowMs: 60_000 };

/**
 * Only trust forwarded headers when the request arrives through a known proxy.
 * Configure trusted proxy IPs via TRUSTED_PROXY_IPS (comma-separated).
 */
const TRUSTED_PROXY_IPS = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
);

function resolveClientIp(request: NextRequest): string {
  const remote = request.ip ?? '';
  if (remote && TRUSTED_PROXY_IPS.has(remote)) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }
  return remote || 'unknown';
}

/**
 * Privacy-safe identity: hash the client IP so raw addresses never appear in
 * metrics or logs. Uses a non-cryptographic hash — sufficient for bucketing.
 */
function hashIdentity(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `id_${(hash >>> 0).toString(36)}`;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function matchBudget(pathname: string): RouteBudget {
  for (const { pattern, budget } of ROUTE_BUDGETS) {
    if (pattern.test(pathname)) return budget;
  }
  return DEFAULT_BUDGET;
}

function emitMetric(route: string, decision: 'allow' | 'block', identity: string): void {
  // Structured, privacy-safe metric: no raw IPs, no request bodies.
  const payload = {
    metric: 'rate_limit_decision',
    route,
    decision,
    identity,
    timestamp: Date.now(),
  };
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(payload));
  }
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const budget = matchBudget(pathname);
  const clientIp = resolveClientIp(request);
  const identity = hashIdentity(clientIp);
  const key = `${pathname}:${identity}`;
  const now = Date.now();

  if (buckets.size > 10_000) pruneExpired(now);

  const existing = buckets.get(key);
  const bucket: Bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + budget.windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > budget.limit) {
    emitMetric(pathname, 'block', identity);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return new NextResponse(
      JSON.stringify({ error: 'Too Many Requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(budget.limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  emitMetric(pathname, 'allow', identity);
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(budget.limit));
  response.headers.set('X-RateLimit-Remaining', String(budget.limit - bucket.count));
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
