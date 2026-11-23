/**
 * API boundary for backend responses.
 *
 * TypeScript interfaces are erased at runtime, so untrusted JSON must be
 * validated before it reaches the renderer. This module provides small,
 * dependency-free runtime schemas plus typed validation errors.
 */

export type ValidationIssue = {
  path: string;
  message: string;
};

export class ApiValidationError extends Error {
  readonly kind = "validation" as const;
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      `Invalid backend response: ${issues
        .map((issue) => `${issue.path || "<root>"}: ${issue.message}`)
        .join("; ")}`
    );
    this.name = "ApiValidationError";
    this.issues = issues;
  }
}

export class ApiRequestError extends Error {
  readonly kind = "request" as const;
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export type Schema<T> = {
  parse: (value: unknown, path?: string) => T;
};

function fail(path: string, message: string): never {
  throw new ApiValidationError([{ path, message }]);
}

export const string = (): Schema<string> => ({
  parse: (value, path = "") =>
    typeof value === "string" ? value : fail(path, "expected string"),
});

export const number = (): Schema<number> => ({
  parse: (value, path = "") =>
    typeof value === "number" && Number.isFinite(value)
      ? value
      : fail(path, "expected finite number"),
});

export const boolean = (): Schema<boolean> => ({
  parse: (value, path = "") =>
    typeof value === "boolean" ? value : fail(path, "expected boolean"),
});

export const array = <T>(item: Schema<T>): Schema<T[]> => ({
  parse: (value, path = "") => {
    if (!Array.isArray(value)) fail(path, "expected array");
    return value.map((entry, index) => item.parse(entry, `${path}[${index}]`));
  },
});

export const object = <T extends Record<string, Schema<unknown>>>(
  shape: T
): Schema<{ [K in keyof T]: ReturnType<T[K]["parse"]> }> => ({
  parse: (value, path = "") => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(path, "expected object");
    }
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      result[key] = shape[key].parse(
        source[key],
        path ? `${path}.${key}` : key
      );
    }
    return result as { [K in keyof T]: ReturnType<T[K]["parse"]> };
  },
});

/**
 * Parse an untrusted JSON payload against a schema.
 * Throws a typed `ApiValidationError` on malformed data.
 */
export function parseResponse<T>(schema: Schema<T>, payload: unknown): T {
  return schema.parse(payload);
}

/**
 * Fetch JSON from the backend and validate it before returning.
 * Network/HTTP failures surface as `ApiRequestError`; malformed bodies as
 * `ApiValidationError`.
 */
export async function fetchJson<T>(
  input: string,
  schema: Schema<T>,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      `Request failed with status ${response.status}`
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiValidationError([{ path: "", message: "invalid JSON body" }]);
  }
  return schema.parse(payload);
}
