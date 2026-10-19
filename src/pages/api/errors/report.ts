import type { NextApiRequest, NextApiResponse } from 'next';

import {
  redactCorrelationId,
  recordErrorDiagnostic,
  getErrorDiagnostics,
  containsSensitiveData,
  CORRELATION_HEADER,
  type RouteGroup,
} from '@/lib/errorCorrelation';

const MAX_BODY_LENGTH = 2000;
const ALLOWED_ROUTE_GROUPS: RouteGroup[] = ['public', 'protected', 'server'];

function pickRouteGroup(value: unknown): RouteGroup {
  return typeof value === 'string' && ALLOWED_ROUTE_GROUPS.includes(value as RouteGroup)
    ? (value as RouteGroup)
    : 'server';
}

function pickErrorKind(value: unknown): string {
  // Error constructors are safe, well-known labels. Anything else is dropped —
  // free-form strings could carry message content (potentially sensitive).
  const kind = typeof value === 'string' ? value : '';
  if (!kind || kind.length > 64 || /[\s<>{}]/.test(kind)) return 'Error';
  return kind;
}

function truncate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return value.length > MAX_BODY_LENGTH ? value.slice(0, MAX_BODY_LENGTH) : value;
}

/**
 * Client error-report sink.
 *
 * Accepts `{ correlationId, routeGroup, errorKind, digest? }` from the route
 * error boundary and stores a sanitized diagnostic. The response echoes the
 * (redacted) correlation ID so the support UI can display it. No wallet,
 * pet, or health data is accepted: the correlation ID is re-redacted on the
 * server and free-form digests that fail `containsSensitiveData` are dropped.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body ?? {};
  const routeGroup = pickRouteGroup(body?.routeGroup);
  const errorKind = pickErrorKind(body?.errorKind);

  // Re-redact on the server: a client-supplied ID containing sensitive data
  // (wallet address, pet name, health term) is discarded and replaced.
  const clientSupplied = typeof body?.correlationId === 'string' ? body.correlationId : undefined;
  if (clientSupplied && containsSensitiveData(clientSupplied)) {
    return res.status(400).json({ error: 'Correlation ID failed redaction check' });
  }
  const correlationId = redactCorrelationId(clientSupplied, routeGroup);

  const digest = truncate(body?.digest);
  const diagnostic = recordErrorDiagnostic({
    correlationId,
    routeGroup,
    errorKind,
    status: typeof body?.status === 'number' ? body.status : undefined,
    timestamp: new Date().toISOString(),
  });
  void digest;

  res.setHeader(CORRELATION_HEADER, correlationId);
  return res.status(202).json({
    ok: true,
    correlationId: diagnostic.correlationId,
    buffered: getErrorDiagnostics().length,
  });
}

function safeParse(raw: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8kb',
    },
  },
};
