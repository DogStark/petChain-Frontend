/**
 * Shared API types and runtime validation helpers.
 *
 * TypeScript interfaces are erased at runtime, so untrusted backend JSON must
 * be validated before it reaches the renderer. The helpers below provide a
 * dependency-free, typed validation layer that can be applied at API
 * boundaries without weakening the existing type surface.
 */

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

/**
 * Typed validation error returned by the API layer when a backend response
 * does not match the expected runtime schema.
 */
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly path: string;
  readonly expected: string;
  readonly received: unknown;

  constructor(path: string, expected: string, received: unknown) {
    super(`Invalid response at "${path}": expected ${expected}`);
    this.name = 'ValidationError';
    this.path = path;
    this.expected = expected;
    this.received = received;
  }
}

/**
 * A runtime schema describing the shape of a value coming from the backend.
 * `parse` returns the validated value or throws a typed `ValidationError`.
 */
export interface Schema<T> {
  parse(value: unknown, path?: string): T;
  safeParse(
    value: unknown,
    path?: string,
  ): { success: true; data: T } | { success: false; error: ValidationError };
}

function makeSchema<T>(
  validate: (value: unknown, path: string) => T,
): Schema<T> {
  return {
    parse(value: unknown, path = '$'): T {
      return validate(value, path);
    },
    safeParse(value: unknown, path = '$') {
      try {
        return { success: true as const, data: validate(value, path) };
      } catch (error) {
        if (error instanceof ValidationError) {
          return { success: false as const, error };
        }
        throw error;
      }
    },
  };
}

export const string = (): Schema<string> =>
  makeSchema((value, path) => {
    if (typeof value !== 'string') {
      throw new ValidationError(path, 'string', value);
    }
    return value;
  });

export const number = (): Schema<number> =>
  makeSchema((value, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ValidationError(path, 'finite number', value);
    }
    return value;
  });

export const boolean = (): Schema<boolean> =>
  makeSchema((value, path) => {
    if (typeof value !== 'boolean') {
      throw new ValidationError(path, 'boolean', value);
    }
    return value;
  });

export const array = <T>(item: Schema<T>): Schema<T[]> =>
  makeSchema((value, path) => {
    if (!Array.isArray(value)) {
      throw new ValidationError(path, 'array', value);
    }
    return value.map((entry, index) => item.parse(entry, `${path}[${index}]`));
  });

export const object = <T extends Record<string, unknown>>(shape: {
  [K in keyof T]: Schema<T[K]>;
}): Schema<T> =>
  makeSchema((value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(path, 'object', value);
    }
    const source = value as Record<string, unknown>;
    const result = {} as T;
    for (const key of Object.keys(shape) as Array<keyof T>) {
      result[key] = shape[key].parse(source[key as string], `${path}.${String(key)}`);
    }
    return result;
  });

/**
 * Validate an untrusted backend payload against a schema. Returns a typed
 * result instead of throwing so callers can surface validation failures
 * through their normal error handling.
 */
export function validateResponse<T>(
  schema: Schema<T>,
  payload: unknown,
): { success: true; data: T } | { success: false; error: ValidationError } {
  return schema.safeParse(payload);
}
