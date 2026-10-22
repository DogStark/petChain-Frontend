import { ApiError, getErrorMessage } from './apiError';

export interface ServerValidationErrorItem {
  field?: string;
  path?: string;
  code?: string;
  message?: string;
}

export interface ServerValidationResult {
  fieldErrors: Record<string, string>;
  globalError: string | null;
}

// Stable API error code to field & message mapping
const STABLE_ERROR_CODE_MAP: Record<string, { field: string; i18nKey: string; fallback: string }> = {
  PET_NAME_REQUIRED: {
    field: 'pet.name',
    i18nKey: 'errors.api.validation.petNameRequired',
    fallback: 'Pet name is required',
  },
  INVALID_DOSAGE: {
    field: 'dosage',
    i18nKey: 'errors.api.validation.invalidDosage',
    fallback: 'Invalid dosage amount',
  },
  DOSAGE_INVALID: {
    field: 'dosage',
    i18nKey: 'errors.api.validation.invalidDosage',
    fallback: 'Invalid dosage amount',
  },
  APPOINTMENT_CONFLICT: {
    field: 'appointment.date',
    i18nKey: 'errors.api.validation.appointmentConflict',
    fallback: 'The selected appointment time is no longer available',
  },
  SLOT_TAKEN: {
    field: 'appointment.date',
    i18nKey: 'errors.api.validation.appointmentConflict',
    fallback: 'The selected appointment time is no longer available',
  },
  STALE_VERSION: {
    field: 'version',
    i18nKey: 'errors.api.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  VERSION_MISMATCH: {
    field: 'version',
    i18nKey: 'errors.api.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  CONCURRENT_MODIFICATION: {
    field: 'version',
    i18nKey: 'errors.api.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  PET_ID_INVALID: {
    field: 'petId',
    i18nKey: 'errors.api.validation.invalidPetId',
    fallback: 'Please select a valid pet',
  },
  VET_ID_REQUIRED: {
    field: 'vetId',
    i18nKey: 'errors.api.validation.invalidVetId',
    fallback: 'Please select a valid veterinarian',
  },
  DATE_REQUIRED: {
    field: 'date',
    i18nKey: 'errors.api.validation.invalidDate',
    fallback: 'Please enter a valid date',
  },
  INVALID_ID: {
    field: 'id',
    i18nKey: 'errors.api.validation.invalidId',
    fallback: 'Invalid identifier',
  },
};

export function mapServerValidationError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string = (k) => k,
): ServerValidationResult {
  const fieldErrors: Record<string, string> = {};
  let hasUnmappedValidationError = false;
  if (error instanceof ApiError) {
    return { fieldErrors, globalError: getErrorMessage(error, t) };
  }

  const root = isRecord(error) ? error : undefined;
  const response = root && isRecord(root.response) ? root.response : undefined;
  const data = response && isRecord(response.data) ? response.data : root;
  if (!data) {
    return { fieldErrors, globalError: getErrorMessage(error, t) };
  }

  const resolveCode = (code: unknown): string | undefined => {
    if (typeof code !== 'string') return undefined;
    const normalized = code.trim().toUpperCase();
    const mapped = STABLE_ERROR_CODE_MAP[normalized];
    if (!mapped) return undefined;
    const translated = t(mapped.i18nKey);
    return translated !== mapped.i18nKey ? translated : mapped.fallback;
  };

  const addMappedFieldError = (field: unknown, code: unknown) => {
    if (typeof code !== 'string') return;
    const mapped = STABLE_ERROR_CODE_MAP[code.trim().toUpperCase()];
    const message = resolveCode(code);
    if (!mapped || !message) {
      hasUnmappedValidationError = true;
      return;
    }
    const targetField = typeof field === 'string' && field.trim() ? field : mapped.field;
    fieldErrors[targetField] = message;
  };

  const fieldErrorData = isRecord(data.fieldErrors) ? data.fieldErrors : undefined;
  if (fieldErrorData) {
    for (const [field, value] of Object.entries(fieldErrorData)) {
      if (typeof value === 'string') {
        addMappedFieldError(field, value);
      } else if (isRecord(value)) {
        addMappedFieldError(field, value.code);
      } else {
        hasUnmappedValidationError = true;
      }
    }
  }

  if (Array.isArray(data.errors)) {
    for (const item of data.errors) {
      if (!isRecord(item)) {
        if (typeof item === 'string') addMappedFieldError(undefined, item);
        else hasUnmappedValidationError = true;
        continue;
      }
      addMappedFieldError(item.field ?? item.path, item.code);
    }
  }

  addMappedFieldError(data.field ?? data.path, data.code);
  if (
    Object.keys(fieldErrors).length === 0 &&
    response?.status === 409 &&
    Array.isArray(data.availableSlots)
  ) {
    addMappedFieldError(undefined, 'APPOINTMENT_CONFLICT');
  }

  if (Object.keys(fieldErrors).length === 0) {
    const topLevelCode = resolveCode(data.code);
    if (topLevelCode) {
      const mapped = typeof data.code === 'string'
        ? STABLE_ERROR_CODE_MAP[data.code.trim().toUpperCase()]
        : undefined;
      if (mapped) fieldErrors[mapped.field] = topLevelCode;
    }
  }

  return {
    fieldErrors,
    globalError:
      hasUnmappedValidationError || Object.keys(fieldErrors).length === 0
        ? getErrorMessage(error, t)
        : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function focusFirstInvalidField(
  fieldErrors: Record<string, string>,
  container: HTMLElement | Document = document,
): boolean {
  const fields = Object.keys(fieldErrors);
  if (fields.length === 0) return false;

  for (const field of fields) {
    const selectors = getFieldSelectors(field);
    for (const selector of selectors) {
      try {
        const el = container.querySelector<HTMLElement>(selector);
        if (el) {
          el.focus();
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          el.setAttribute('aria-invalid', 'true');
          return true;
        }
      } catch {
        // Ignore invalid selector syntax
      }
    }
  }

  return false;
}

function getFieldSelectors(field: string): string[] {
  const selectors: string[] = [];
  selectors.push(`[name="${field}"]`);
  selectors.push(`[data-field="${field}"]`);
  selectors.push(`[id="${field}"]`);

  // Dot to bracket notation (e.g. pet.name -> pet[name])
  if (field.includes('.')) {
    const bracketNotation = field.split('.').reduce((acc, part, idx) => {
      return idx === 0 ? part : `${acc}[${part}]`;
    }, '');
    selectors.push(`[name="${bracketNotation}"]`);
    selectors.push(`[id="${bracketNotation}"]`);
  }

  // Array item notation (e.g. dosages[0].amount, medications.1.dosage)
  const normalized = field.replace(/\[(\d+)\]\.?/g, '.$1.');
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length > 1) {
    const bracketSql = parts.reduce((acc, part, idx) => {
      return idx === 0 ? part : `${acc}[${part}]`;
    }, '');
    selectors.push(`[name="${bracketSql}"]`);

    const dotSql = parts.join('.');
    selectors.push(`[name="${dotSql}"]`);
    selectors.push(`[data-field="${dotSql}"]`);
  }

  const lastSegment = field.split('.').pop()?.split('[').pop()?.replace(']', '');
  if (lastSegment && lastSegment !== field) {
    selectors.push(`[name="${lastSegment}"]`);
    selectors.push(`[id="${lastSegment}"]`);
  }

  return selectors;
}
