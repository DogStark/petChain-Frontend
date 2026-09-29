/**
 * Runtime validation schemas for medical records.
 *
 * These schemas are the single source of truth shared by record forms and API
 * clients so that required fields, date formats, maximum lengths, attachments
 * and optional fields stay aligned with the documented server constraints.
 *
 * The module is dependency-free (no zod/yup) so it can be imported from both
 * the form layer and the API client without pulling extra runtime weight.
 */

export type FieldErrors = Record<string, string>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: FieldErrors;
}

/** Documented server constraints for medical records. */
export const MEDICAL_RECORD_CONSTRAINTS = {
  title: { required: true, minLength: 1, maxLength: 200 },
  recordType: { required: true, allowed: ['diagnosis', 'prescription', 'lab_result', 'imaging', 'note', 'procedure'] },
  recordDate: { required: true, format: 'YYYY-MM-DD' },
  description: { required: false, maxLength: 5000 },
  provider: { required: false, maxLength: 200 },
  attachments: { required: false, maxCount: 10, maxSizeBytes: 10 * 1024 * 1024 },
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a YYYY-MM-DD string and rejects impossible calendar dates
 * (e.g. 2024-02-31) so bad values never reach the mutation call.
 */
export function isValidRecordDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export interface MedicalRecordAttachment {
  name?: string;
  size?: number;
  url?: string;
}

export interface MedicalRecordInput {
  title?: unknown;
  recordType?: unknown;
  recordDate?: unknown;
  description?: unknown;
  provider?: unknown;
  attachments?: unknown;
}

function validateAttachment(value: unknown, index: number, errors: FieldErrors): void {
  const key = `attachments.${index}`;
  if (value === null || typeof value !== 'object') {
    errors[key] = 'Attachment must be an object.';
    return;
  }
  const attachment = value as MedicalRecordAttachment;
  if (attachment.size !== undefined) {
    if (typeof attachment.size !== 'number' || attachment.size < 0) {
      errors[key] = 'Attachment size must be a non-negative number.';
    } else if (attachment.size > MEDICAL_RECORD_CONSTRAINTS.attachments.maxSizeBytes) {
      errors[key] = `Attachment exceeds the ${MEDICAL_RECORD_CONSTRAINTS.attachments.maxSizeBytes} byte limit.`;
    }
  }
}

function validateCommon(input: MedicalRecordInput, errors: FieldErrors): void {
  const { title, recordType, recordDate, description, provider, attachments } = input;

  if (title === undefined || title === null || title === '') {
    errors.title = 'Title is required.';
  } else if (typeof title !== 'string') {
    errors.title = 'Title must be text.';
  } else if (title.length > MEDICAL_RECORD_CONSTRAINTS.title.maxLength) {
    errors.title = `Title must be at most ${MEDICAL_RECORD_CONSTRAINTS.title.maxLength} characters.`;
  }

  if (recordType === undefined || recordType === null || recordType === '') {
    errors.recordType = 'Record type is required.';
  } else if (!(MEDICAL_RECORD_CONSTRAINTS.recordType.allowed as readonly string[]).includes(recordType as string)) {
    errors.recordType = `Record type must be one of: ${MEDICAL_RECORD_CONSTRAINTS.recordType.allowed.join(', ')}.`;
  }

  if (recordDate === undefined || recordDate === null || recordDate === '') {
    errors.recordDate = 'Record date is required.';
  } else if (!isValidRecordDate(recordDate)) {
    errors.recordDate = 'Record date must be a valid date in YYYY-MM-DD format.';
  }

  if (description !== undefined && description !== null && description !== '') {
    if (typeof description !== 'string') {
      errors.description = 'Description must be text.';
    } else if (description.length > MEDICAL_RECORD_CONSTRAINTS.description.maxLength) {
      errors.description = `Description must be at most ${MEDICAL_RECORD_CONSTRAINTS.description.maxLength} characters.`;
    }
  }

  if (provider !== undefined && provider !== null && provider !== '') {
    if (typeof provider !== 'string') {
      errors.provider = 'Provider must be text.';
    } else if (provider.length > MEDICAL_RECORD_CONSTRAINTS.provider.maxLength) {
      errors.provider = `Provider must be at most ${MEDICAL_RECORD_CONSTRAINTS.provider.maxLength} characters.`;
    }
  }

  if (attachments !== undefined && attachments !== null) {
    if (!Array.isArray(attachments)) {
      errors.attachments = 'Attachments must be a list.';
    } else if (attachments.length > MEDICAL_RECORD_CONSTRAINTS.attachments.maxCount) {
      errors.attachments = `At most ${MEDICAL_RECORD_CONSTRAINTS.attachments.maxCount} attachments are allowed.`;
    } else {
      attachments.forEach((attachment, index) => validateAttachment(attachment, index, errors));
    }
  }
}

/**
 * Schema for creating a medical record. All required fields must be present.
 */
export function validateMedicalRecordCreate(input: MedicalRecordInput): ValidationResult<MedicalRecordInput> {
  const errors: FieldErrors = {};
  validateCommon(input, errors);
  return { success: Object.keys(errors).length === 0, data: errors && Object.keys(errors).length === 0 ? input : undefined, errors };
}

/**
 * Schema for updating a medical record. Fields are optional, but any field
 * that is present must still satisfy the documented constraints.
 */
export function validateMedicalRecordUpdate(input: MedicalRecordInput): ValidationResult<MedicalRecordInput> {
  const errors: FieldErrors = {};
  const partial: MedicalRecordInput = {};

  (['title', 'recordType', 'recordDate', 'description', 'provider', 'attachments'] as const).forEach((key) => {
    if (input[key] !== undefined) {
      (partial as Record<string, unknown>)[key] = input[key];
    }
  });

  if (partial.title !== undefined) {
    if (partial.title === null || partial.title === '') {
      errors.title = 'Title cannot be empty.';
    } else if (typeof partial.title !== 'string') {
      errors.title = 'Title must be text.';
    } else if (partial.title.length > MEDICAL_RECORD_CONSTRAINTS.title.maxLength) {
      errors.title = `Title must be at most ${MEDICAL_RECORD_CONSTRAINTS.title.maxLength} characters.`;
    }
  }

  if (partial.recordType !== undefined) {
    if (!(MEDICAL_RECORD_CONSTRAINTS.recordType.allowed as readonly string[]).includes(partial.recordType as string)) {
      errors.recordType = `Record type must be one of: ${MEDICAL_RECORD_CONSTRAINTS.recordType.allowed.join(', ')}.`;
    }
  }

  if (partial.recordDate !== undefined && !isValidRecordDate(partial.recordDate)) {
    errors.recordDate = 'Record date must be a valid date in YYYY-MM-DD format.';
  }

  if (partial.description !== undefined && partial.description !== null && partial.description !== '') {
    if (typeof partial.description !== 'string') {
      errors.description = 'Description must be text.';
    } else if (partial.description.length > MEDICAL_RECORD_CONSTRAINTS.description.maxLength) {
      errors.description = `Description must be at most ${MEDICAL_RECORD_CONSTRAINTS.description.maxLength} characters.`;
    }
  }

  if (partial.provider !== undefined && partial.provider !== null && partial.provider !== '') {
    if (typeof partial.provider !== 'string') {
      errors.provider = 'Provider must be text.';
    } else if (partial.provider.length > MEDICAL_RECORD_CONSTRAINTS.provider.maxLength) {
      errors.provider = `Provider must be at most ${MEDICAL_RECORD_CONSTRAINTS.provider.maxLength} characters.`;
    }
  }

  if (partial.attachments !== undefined && partial.attachments !== null) {
    if (!Array.isArray(partial.attachments)) {
      errors.attachments = 'Attachments must be a list.';
    } else if (partial.attachments.length > MEDICAL_RECORD_CONSTRAINTS.attachments.maxCount) {
      errors.attachments = `At most ${MEDICAL_RECORD_CONSTRAINTS.attachments.maxCount} attachments are allowed.`;
    } else {
      partial.attachments.forEach((attachment, index) => validateAttachment(attachment, index, errors));
    }
  }

  const success = Object.keys(errors).length === 0;
  return { success, data: success ? partial : undefined, errors };
}

/**
 * Validates a server response payload at the API boundary. Unknown fields are
 * preserved; only the documented constraints are enforced.
 */
export function validateMedicalRecordResponse(payload: unknown): ValidationResult<MedicalRecordInput> {
  if (payload === null || typeof payload !== 'object') {
    return { success: false, errors: { _root: 'Response payload must be an object.' } };
  }
  return validateMedicalRecordCreate(payload as MedicalRecordInput);
}

/**
 * Maps a server field error payload to form control names. Accepts either a
 * flat `{ field: message }` map or a nested `{ errors: { field: message } }`
 * shape and returns a normalized `{ controlName: message }` map.
 */
export function mapServerFieldErrors(payload: unknown): FieldErrors {
  const mapped: FieldErrors = {};
  if (payload === null || typeof payload !== 'object') return mapped;

  const source = (payload as { errors?: unknown }).errors ?? payload;
  if (source === null || typeof source !== 'object') return mapped;

  Object.entries(source as Record<string, unknown>).forEach(([field, message]) => {
    if (typeof message === 'string') {
      mapped[field] = message;
    } else if (Array.isArray(message) && typeof message[0] === 'string') {
      mapped[field] = message[0];
    }
  });

  return mapped;
}

/**
 * Emits an observable schema-failure signal without logging record contents.
 * Consumers can subscribe to surface metrics/telemetry safely.
 */
export function reportSchemaFailure(context: string, errors: FieldErrors): void {
  const fields = Object.keys(errors);
  if (fields.length === 0) return;
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[medicalRecordSchema] validation failed (${context})`, { fields });
  }
}

/**
 * Contract fixture for backend alignment. Contains representative valid and
 * invalid records, dates, attachments and optional fields.
 */
export const MEDICAL_RECORD_CONTRACT_FIXTURE = {
  valid: {
    create: {
      title: 'Annual physical',
      recordType: 'note',
      recordDate: '2024-03-15',
      description: 'Routine checkup, no findings.',
      provider: 'Dr. Rivera',
      attachments: [{ name: 'labs.pdf', size: 2048, url: 'https://example.test/labs.pdf' }],
    },
    update: { description: 'Updated notes.' },
  },
  invalid: {
    missingRequired: { recordType: 'note', recordDate: '2024-03-15' },
    badDate: { title: 'Visit', recordType: 'note', recordDate: '2024-02-31' },
    badDateFormat: { title: 'Visit', recordType: 'note', recordDate: '03/15/2024' },
    tooLongTitle: { title: 'x'.repeat(201), recordType: 'note', recordDate: '2024-03-15' },
    tooManyAttachments: {
      title: 'Visit',
      recordType: 'note',
      recordDate: '2024-03-15',
      attachments: Array.from({ length: 11 }, () => ({ name: 'a.pdf', size: 1 })),
    },
    oversizedAttachment: {
      title: 'Visit',
      recordType: 'note',
      recordDate: '2024-03-15',
      attachments: [{ name: 'big.pdf', size: 11 * 1024 * 1024 }],
    },
  },
} as const;
