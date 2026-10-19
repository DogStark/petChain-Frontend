import { z } from "zod";

/**
 * Runtime validation schemas for medical records.
 *
 * These schemas are the single source of truth for record field constraints
 * and are shared by record forms (at submission time) and API clients (at
 * response boundaries). They mirror the documented server constraints so that
 * invalid values never reach the mutation call and server field errors can be
 * mapped back to the correct form control.
 */

const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;
const MAX_ATTACHMENTS = 10;

/** ISO-8601 calendar date, e.g. 2024-01-31. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date is not a valid calendar date");

/** ISO-8601 date-time, e.g. 2024-01-31T12:00:00Z. */
export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Date-time must be a valid ISO-8601 timestamp");

export const attachmentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(MAX_NAME_LENGTH),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string().url().optional(),
});

export type RecordAttachment = z.infer<typeof attachmentSchema>;

/** Fields required when creating a record. */
export const recordCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  title: z.string().min(1, "Title is required").max(MAX_NAME_LENGTH, `Title must be at most ${MAX_NAME_LENGTH} characters`),
  recordDate: isoDateSchema,
  notes: z.string().max(MAX_NOTES_LENGTH, `Notes must be at most ${MAX_NOTES_LENGTH} characters`).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS, `At most ${MAX_ATTACHMENTS} attachments are allowed`).optional(),
});

export type RecordCreateInput = z.infer<typeof recordCreateSchema>;

/** Fields allowed when updating a record; all optional, but validated when present. */
export const recordUpdateSchema = recordCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type RecordUpdateInput = z.infer<typeof recordUpdateSchema>;

/** Shape returned by the API for a persisted record. */
export const recordResponseSchema = recordCreateSchema.extend({
  id: z.string().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type RecordResponse = z.infer<typeof recordResponseSchema>;

/**
 * Contract fixture exported for backend alignment. Kept intentionally small and
 * free of any real patient data.
 */
export const recordContractFixture = {
  valid: {
    patientId: "patient-1",
    title: "Annual checkup",
    recordDate: "2024-01-31",
    notes: "Routine visit",
    attachments: [
      { id: "att-1", fileName: "labs.pdf", contentType: "application/pdf", sizeBytes: 1024 },
    ],
  },
  invalid: {
    patientId: "",
    title: "",
    recordDate: "31-01-2024",
    notes: "x".repeat(MAX_NOTES_LENGTH + 1),
    attachments: [],
  },
} as const;

/**
 * A single field-level validation error, keyed by the form control name so it
 * can be surfaced directly on the matching input.
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Validate a create payload before it reaches the mutation call. Returns the
 * parsed value on success, or a list of field errors on failure. Never logs
 * record contents.
 */
export function validateRecordCreate(
  input: unknown,
): { success: true; data: RecordCreateInput } | { success: false; errors: FieldError[] } {
  const result = recordCreateSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: toFieldErrors(result.error) };
}

/** Validate an update payload before it reaches the mutation call. */
export function validateRecordUpdate(
  input: unknown,
): { success: true; data: RecordUpdateInput } | { success: false; errors: FieldError[] } {
  const result = recordUpdateSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: toFieldErrors(result.error) };
}

/**
 * Validate a server response at the API boundary. Returns the normalized record
 * on success, or field errors on failure so callers can surface them without
 * logging record contents.
 */
export function validateRecordResponse(
  input: unknown,
): { success: true; data: RecordResponse } | { success: false; errors: FieldError[] } {
  const result = recordResponseSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: toFieldErrors(result.error) };
}

/**
 * Map a server error payload (e.g. { field: "title", message: "..." } or
 * { errors: { title: "..." } }) to field errors keyed by control name.
 */
export function mapServerFieldErrors(payload: unknown): FieldError[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const errors: FieldError[] = [];

  if (Array.isArray(record.errors)) {
    for (const entry of record.errors) {
      if (entry && typeof entry === "object") {
        const { field, message } = entry as { field?: unknown; message?: unknown };
        if (typeof field === "string" && typeof message === "string") {
          errors.push({ field, message });
        }
      }
    }
  } else if (record.errors && typeof record.errors === "object") {
    for (const [field, message] of Object.entries(record.errors as Record<string, unknown>)) {
      if (typeof message === "string") {
        errors.push({ field, message });
      }
    }
  }

  if (typeof record.field === "string" && typeof record.message === "string") {
    errors.push({ field: record.field, message: record.message });
  }

  return errors;
}

function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "_root",
    message: issue.message,
  }));
}
