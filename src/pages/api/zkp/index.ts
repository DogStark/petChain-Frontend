import type { NextApiRequest, NextApiResponse } from "next";

/**
 * ZKP generation and verification endpoint.
 *
 * Proof payloads are computationally sensitive, so requests are bounded
 * before any proof work happens: body size, field complexity, and proof
 * shape are validated up front and malformed proofs are rejected early.
 */

// Maximum accepted request body size (bytes).
const MAX_BODY_BYTES = 64 * 1024;
// Maximum accepted proof string length (characters).
const MAX_PROOF_LENGTH = 32 * 1024;
// Maximum accepted public input string length (characters).
const MAX_INPUT_LENGTH = 4 * 1024;
// Maximum number of public inputs per request.
const MAX_INPUTS = 64;
// Maximum accepted circuit identifier length (characters).
const MAX_CIRCUIT_ID_LENGTH = 128;
// Upper bound on proof generation/verification work (milliseconds).
const PROOF_TIMEOUT_MS = 10_000;

const CIRCUIT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;

interface ZkpRequestBody {
  action?: unknown;
  circuitId?: unknown;
  proof?: unknown;
  inputs?: unknown;
}

class ValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function assertBodySize(req: NextApiRequest): void {
  const contentLength = req.headers["content-length"];
  if (typeof contentLength === "string") {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      throw new ValidationError("Request body too large", 413);
    }
  }

  const raw = req.body;
  if (typeof raw === "string" && byteLength(raw) > MAX_BODY_BYTES) {
    throw new ValidationError("Request body too large", 413);
  }
}

function validateCircuitId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError("circuitId is required");
  }
  if (value.length > MAX_CIRCUIT_ID_LENGTH) {
    throw new ValidationError("circuitId is too long");
  }
  if (!CIRCUIT_ID_PATTERN.test(value)) {
    throw new ValidationError("circuitId contains invalid characters");
  }
  return value;
}

function validateProof(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError("proof is required");
  }
  if (value.length > MAX_PROOF_LENGTH) {
    throw new ValidationError("proof is too large");
  }
  if (value.length % 2 !== 0 || !HEX_PATTERN.test(value)) {
    throw new ValidationError("proof must be a hex-encoded string");
  }
  return value;
}

function validateInputs(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError("inputs must be an array");
  }
  if (value.length > MAX_INPUTS) {
    throw new ValidationError("too many inputs");
  }
  return value.map((input, index) => {
    if (typeof input !== "string") {
      throw new ValidationError(`inputs[${index}] must be a string`);
    }
    if (input.length > MAX_INPUT_LENGTH) {
      throw new ValidationError(`inputs[${index}] is too large`);
    }
    return input;
  });
}

function parseBody(req: NextApiRequest): ZkpRequestBody {
  const body = req.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body as ZkpRequestBody;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ValidationError("Proof operation timed out", 504));
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

async function generateProof(
  circuitId: string,
  inputs: string[],
): Promise<{ proof: string }> {
  // Placeholder for the proof generation pipeline. The bounded inputs above
  // guarantee this work stays within the accepted complexity envelope.
  void circuitId;
  void inputs;
  return { proof: "" };
}

async function verifyProof(
  circuitId: string,
  proof: string,
  inputs: string[],
): Promise<{ valid: boolean }> {
  // Placeholder for the proof verification pipeline.
  void circuitId;
  void proof;
  void inputs;
  return { valid: false };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    assertBodySize(req);
    const body = parseBody(req);

    const action = body.action;
    if (action !== "generate" && action !== "verify") {
      throw new ValidationError("action must be 'generate' or 'verify'");
    }

    const circuitId = validateCircuitId(body.circuitId);
    const inputs = validateInputs(body.inputs);

    if (action === "generate") {
      const result = await withTimeout(
        generateProof(circuitId, inputs),
        PROOF_TIMEOUT_MS,
      );
      return res.status(200).json(result);
    }

    const proof = validateProof(body.proof);
    const result = await withTimeout(
      verifyProof(circuitId, proof, inputs),
      PROOF_TIMEOUT_MS,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
