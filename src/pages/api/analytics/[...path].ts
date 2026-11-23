import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

const ANALYTICS_BASE_URL =
  process.env.ANALYTICS_API_URL ?? "http://localhost:4000";

const ALLOWED_ROLES = ["admin", "analyst"] as const;

const ALLOWED_METHODS = ["GET", "POST"] as const;

// Only forward a fixed allowlist of query params to the analytics backend.
const ALLOWED_QUERY_PARAMS = [
  "from",
  "to",
  "range",
  "metric",
  "interval",
  "limit",
  "offset",
  "groupBy",
] as const;

// Headers that must never be trusted from the client.
const STRIPPED_REQUEST_HEADERS = [
  "authorization",
  "cookie",
  "x-user-id",
  "x-user-role",
  "x-forwarded-user",
  "x-forwarded-email",
  "x-forwarded-for",
];

const MAX_PATH_SEGMENTS = 8;
const MAX_LIMIT = 1000;
const MAX_OFFSET = 100000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

function isValidPathSegment(segment: string): boolean {
  return SAFE_SEGMENT_PATTERN.test(segment) && segment !== "..";
}

function parseBoundedInt(value: string, max: number): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) {
    return null;
  }
  return parsed;
}

function buildForwardQuery(
  query: NextApiRequest["query"],
): Record<string, string> | null {
  const result: Record<string, string> = {};

  for (const key of ALLOWED_QUERY_PARAMS) {
    const raw = query[key];
    if (raw === undefined) {
      continue;
    }
    if (Array.isArray(raw)) {
      return null;
    }

    if (key === "limit") {
      const parsed = parseBoundedInt(raw, MAX_LIMIT);
      if (parsed === null) {
        return null;
      }
      result[key] = String(parsed);
      continue;
    }

    if (key === "offset") {
      const parsed = parseBoundedInt(raw, MAX_OFFSET);
      if (parsed === null) {
        return null;
      }
      result[key] = String(parsed);
      continue;
    }

    if (key === "from" || key === "to") {
      if (!DATE_PATTERN.test(raw)) {
        return null;
      }
      result[key] = raw;
      continue;
    }

    if (raw.length > 128) {
      return null;
    }
    result[key] = raw;
  }

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const method = req.method ?? "GET";
  if (!ALLOWED_METHODS.includes(method as (typeof ALLOWED_METHODS)[number])) {
    res.setHeader("Allow", ALLOWED_METHODS.join(", "));
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const role = session?.user?.role;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rawPath = req.query.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  if (
    segments.length === 0 ||
    segments.length > MAX_PATH_SEGMENTS ||
    !segments.every(isValidPathSegment)
  ) {
    return res.status(400).json({ error: "Invalid analytics path" });
  }

  const forwardQuery = buildForwardQuery(req.query);
  if (forwardQuery === null) {
    return res.status(400).json({ error: "Invalid query parameters" });
  }

  const targetUrl = new URL(
    `${ANALYTICS_BASE_URL.replace(/\/$/, "")}/${segments.join("/")}`,
  );
  for (const [key, value] of Object.entries(forwardQuery)) {
    targetUrl.searchParams.set(key, value);
  }

  const forwardHeaders: Record<string, string> = {
    accept: "application/json",
    // Identity is derived from the verified session, never from client input.
    "x-user-id": session.user.id ?? "",
    "x-user-role": role,
  };

  let body: string | undefined;
  if (method === "POST") {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      return res.status(415).json({ error: "Unsupported media type" });
    }
    forwardHeaders["content-type"] = "application/json";
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  }

  // Ensure no spoofable identity headers leak through from the client.
  for (const header of STRIPPED_REQUEST_HEADERS) {
    delete req.headers[header];
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers: forwardHeaders,
      body,
    });

    const upstreamBody = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", "application/json");
    return res.send(upstreamBody);
  } catch {
    return res.status(502).json({ error: "Analytics service unavailable" });
  }
}
