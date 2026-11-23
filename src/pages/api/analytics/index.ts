import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

const ANALYTICS_BACKEND_URL =
  process.env.ANALYTICS_BACKEND_URL ?? "http://localhost:4000";

const ALLOWED_ROLES = ["admin", "analyst"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const ALLOWED_RANGES = ["24h", "7d", "30d", "90d"] as const;
type AllowedRange = (typeof ALLOWED_RANGES)[number];

const ALLOWED_METRICS = [
  "visits",
  "signups",
  "adoptions",
  "active_users",
] as const;
type AllowedMetric = (typeof ALLOWED_METRICS)[number];

const MAX_IDENTIFIER_LENGTH = 128;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

interface AnalyticsQuery {
  range: AllowedRange;
  metric: AllowedMetric;
  segment?: string;
}

function isAllowedRole(role: unknown): role is AllowedRole {
  return typeof role === "string" && (ALLOWED_ROLES as readonly string[]).includes(role);
}

function isAllowedRange(value: unknown): value is AllowedRange {
  return typeof value === "string" && (ALLOWED_RANGES as readonly string[]).includes(value);
}

function isAllowedMetric(value: unknown): value is AllowedMetric {
  return typeof value === "string" && (ALLOWED_METRICS as readonly string[]).includes(value);
}

function isValidSegment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function parseQuery(req: NextApiRequest):
  | { ok: true; query: AnalyticsQuery }
  | { ok: false; error: string } {
  const { range, metric, segment } = req.query;

  if (Array.isArray(range) || Array.isArray(metric) || Array.isArray(segment)) {
    return { ok: false, error: "Repeated query parameters are not allowed" };
  }

  if (!isAllowedRange(range)) {
    return { ok: false, error: "Invalid or missing 'range' parameter" };
  }

  if (!isAllowedMetric(metric)) {
    return { ok: false, error: "Invalid or missing 'metric' parameter" };
  }

  if (segment !== undefined && !isValidSegment(segment)) {
    return { ok: false, error: "Invalid 'segment' parameter" };
  }

  return { ok: true, query: { range, metric, segment } };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user as { role?: unknown }).role;

  if (!isAllowedRole(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = parseQuery(req);

  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const { range, metric, segment } = parsed.query;

  const backendUrl = new URL("/analytics", ANALYTICS_BACKEND_URL);
  backendUrl.searchParams.set("range", range);
  backendUrl.searchParams.set("metric", metric);
  if (segment !== undefined) {
    backendUrl.searchParams.set("segment", segment);
  }

  // Forward identity from the verified server session only. Never trust
  // client-supplied identity headers, which could be spoofed.
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Authenticated-User-Id": String(session.user.id ?? ""),
    "X-Authenticated-User-Role": role,
  };

  if (process.env.ANALYTICS_BACKEND_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ANALYTICS_BACKEND_TOKEN}`;
  }

  try {
    const backendResponse = await fetch(backendUrl.toString(), {
      method: "GET",
      headers,
    });

    if (!backendResponse.ok) {
      return res
        .status(backendResponse.status === 404 ? 404 : 502)
        .json({ error: "Analytics backend request failed" });
    }

    const data = await backendResponse.json();
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: "Analytics backend unavailable" });
  }
}
