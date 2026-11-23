import type { NextApiRequest, NextApiResponse } from "next";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STRING_LENGTH = 4096;
const MAX_ARRAY_LENGTH = 256;
const MAX_OBJECT_KEYS = 64;
const MAX_DEPTH = 8;
const REQUEST_TIMEOUT_MS = 10_000;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface GenerateResponse {
  proof?: string;
  error?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateComplexity(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH) {
    return "Payload nesting is too deep";
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return `String field exceeds maximum length of ${MAX_STRING_LENGTH}`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      return `Array exceeds maximum length of ${MAX_ARRAY_LENGTH}`;
    }
    for (const item of value) {
      const error = validateComplexity(item, depth + 1);
      if (error) return error;
    }
    return null;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) {
      return `Object exceeds maximum of ${MAX_OBJECT_KEYS} keys`;
    }
    for (const key of keys) {
      const error = validateComplexity(value[key], depth + 1);
      if (error) return error;
    }
    return null;
  }

  return null;
}

function parseBody(req: NextApiRequest): { body?: JsonValue; error?: string } {
  const raw = req.body;

  if (raw === undefined || raw === null) {
    return { error: "Request body is required" };
  }

  let parsed: unknown = raw;

  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return { error: `Request body exceeds maximum size of ${MAX_BODY_BYTES} bytes` };
    }
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Request body must be valid JSON" };
    }
  } else {
    const serialized = JSON.stringify(raw);
    if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
      return { error: `Request body exceeds maximum size of ${MAX_BODY_BYTES} bytes` };
    }
  }

  if (!isPlainObject(parsed)) {
    return { error: "Request body must be a JSON object" };
  }

  const complexityError = validateComplexity(parsed);
  if (complexityError) {
    return { error: complexityError };
  }

  return { body: parsed as JsonValue };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Proof generation timed out"));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function generateProof(body: JsonValue): Promise<string> {
  // Placeholder for the actual proof generation pipeline.
  // The payload has already been validated for size and complexity.
  return JSON.stringify(body);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponse>,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { body, error } = parseBody(req);
  if (error || body === undefined) {
    res.status(400).json({ error: error ?? "Invalid request body" });
    return;
  }

  try {
    const proof = await withTimeout(generateProof(body), REQUEST_TIMEOUT_MS);
    res.status(200).json({ proof });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proof generation failed";
    const status = message === "Proof generation timed out" ? 504 : 500;
    res.status(status).json({ error: message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16kb",
    },
  },
};
