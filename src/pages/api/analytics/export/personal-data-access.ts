import type { NextApiRequest, NextApiResponse } from 'next';

import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

/**
 * Personal-data access decision for analytics exports.
 *
 * This route never decides on its own whether identifiers may be exported
 * unmasked: it only *asks* the backend (which owns authorization and consent)
 * and fails closed whenever the answer is unavailable. The client can request
 * personal data, but it can never grant it.
 */

export interface PersonalDataAccessResponse {
  allowed: boolean;
  reason?: string;
  message?: string;
  scope?: { startDate?: string; endDate?: string };
}

/** Consent is never scoped beyond ~12 months of analytics data. */
const MAX_SCOPE_DAYS = 366;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type QueryValue = string | string[] | undefined;

function firstValue(value: QueryValue): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === undefined || candidate === '' ? undefined : candidate;
}

function readAuthToken(req: NextApiRequest): string | undefined {
  const header = req.headers.authorization;
  if (header) return header;

  const cookie = req.headers.cookie;
  if (cookie?.includes('authToken=')) {
    const raw = cookie.split('authToken=')[1]?.split(';')[0];
    return raw ? `Bearer ${raw}` : undefined;
  }
  return undefined;
}

function invalidRange(res: NextApiResponse, message: string): NextApiResponse {
  return res.status(400).json({
    allowed: false,
    reason: 'invalid_range',
    message,
  } satisfies PersonalDataAccessResponse);
}

function scopeDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function upstreamDecision(status: number, payload: unknown): PersonalDataAccessResponse {
  const body = (payload ?? {}) as Partial<PersonalDataAccessResponse>;
  if (status === 401) {
    return {
      allowed: false,
      reason: 'authentication_required',
      message: body.message ?? 'Your session has expired. Sign in again to request personal data.',
    };
  }
  if (status === 403) {
    return {
      allowed: false,
      reason: body.reason ?? 'consent_not_granted',
      message:
        body.message ??
        'Personal data is not authorised for this account. The export stays masked.',
    };
  }
  return {
    allowed: body.allowed === true,
    reason: body.reason,
    message: body.message,
    scope: body.scope,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const startDate = firstValue(req.query.startDate);
  const endDate = firstValue(req.query.endDate);

  for (const [name, value] of [
    ['startDate', startDate],
    ['endDate', endDate],
  ] as const) {
    if (value !== undefined && (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value)))) {
      return invalidRange(res, `${name} must be a valid YYYY-MM-DD date.`);
    }
  }

  if (startDate && endDate) {
    if (startDate > endDate) {
      return invalidRange(res, 'startDate must be on or before endDate.');
    }
    if (scopeDays(startDate, endDate) > MAX_SCOPE_DAYS) {
      return res.status(403).json({
        allowed: false,
        reason: 'scope_exceeded',
        message: 'Consent covers at most 12 months of analytics data.',
      } satisfies PersonalDataAccessResponse);
    }
  }

  // Server-side demo flag: a client cannot set environment variables.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return res.status(200).json({
      allowed: true,
      reason: 'demo_mode',
      scope: { startDate, endDate },
    } satisfies PersonalDataAccessResponse);
  }

  const token = readAuthToken(req);
  if (!token) {
    return res.status(401).json({
      allowed: false,
      reason: 'authentication_required',
      message: 'Sign in to include personal data in this export.',
    } satisfies PersonalDataAccessResponse);
  }

  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  const suffix = query.toString();

  try {
    const upstream = await fetch(
      `${getApiBaseUrl()}/analytics/export/personal-data-access${suffix ? `?${suffix}` : ''}`,
      { method: 'GET', headers: { Authorization: token } },
    );

    if (upstream.ok) {
      return res.status(200).json(upstreamDecision(200, await upstream.json()));
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return res
        .status(upstream.status)
        .json(upstreamDecision(upstream.status, await upstream.json().catch(() => null)));
    }
    // Unknown/failed backend answer: fail closed, keep the export masked.
    return res.status(503).json({
      allowed: false,
      reason: 'authorization_unavailable',
      message: 'Could not verify personal-data access. The export stays masked.',
    } satisfies PersonalDataAccessResponse);
  } catch {
    return res.status(503).json({
      allowed: false,
      reason: 'authorization_unavailable',
      message: 'Could not verify personal-data access. The export stays masked.',
    } satisfies PersonalDataAccessResponse);
  }
}
