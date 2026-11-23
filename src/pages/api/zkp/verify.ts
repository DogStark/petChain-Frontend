import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Bounds for ZKP verification payloads. Proofs are computationally sensitive,
// so reject oversized or malformed input before it reaches the backend.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PROOF_LENGTH = 32 * 1024;
const MAX_PUBLIC_INPUTS = 64;
const MAX_PUBLIC_INPUT_LENGTH = 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePayload(body: unknown): string | null {
  if (!isPlainObject(body)) {
    return 'Request body must be a JSON object';
  }

  const { proof, publicInputs } = body;

  if (typeof proof !== 'string' || proof.length === 0) {
    return 'Missing or invalid "proof" field';
  }
  if (proof.length > MAX_PROOF_LENGTH) {
    return `"proof" exceeds maximum length of ${MAX_PROOF_LENGTH} characters`;
  }

  if (publicInputs !== undefined) {
    if (!Array.isArray(publicInputs)) {
      return '"publicInputs" must be an array';
    }
    if (publicInputs.length > MAX_PUBLIC_INPUTS) {
      return `"publicInputs" exceeds maximum of ${MAX_PUBLIC_INPUTS} entries`;
    }
    for (const input of publicInputs) {
      if (typeof input !== 'string') {
        return '"publicInputs" entries must be strings';
      }
      if (input.length > MAX_PUBLIC_INPUT_LENGTH) {
        return `"publicInputs" entry exceeds maximum length of ${MAX_PUBLIC_INPUT_LENGTH} characters`;
      }
    }
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${BACKEND}/zkp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'Verification timed out' });
    }
    return res.status(502).json({ error: 'Verification service unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}
