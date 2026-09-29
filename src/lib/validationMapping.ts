import { AxiosError } from 'axios';
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
    i18nKey: 'errors.validation.petNameRequired',
    fallback: 'Pet name is required',
  },
  INVALID_DOSAGE: {
    field: 'dosage',
    i18nKey: 'errors.validation.invalidDosage',
    fallback: 'Invalid dosage amount',
  },
  DOSAGE_INVALID: {
    field: 'dosage',
    i18nKey: 'errors.validation.invalidDosage',
    fallback: 'Invalid dosage amount',
  },
  APPOINTMENT_CONFLICT: {
    field: 'appointment.date',
    i18nKey: 'errors.validation.appointmentConflict',
    fallback: 'The selected appointment time is no longer available',
  },
  SLOT_TAKEN: {
    field: 'appointment.date',
    i18nKey: 'errors.validation.appointmentConflict',
    fallback: 'The selected appointment time is no longer available',
  },
  STALE_VERSION: {
    field: 'version',
    i18nKey: 'errors.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  VERSION_MISMATCH: {
    field: 'version',
    i18nKey: 'errors.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  CONCURRENT_MODIFICATION: {
    field: 'version',
    i18nKey: 'errors.validation.staleVersion',
    fallback: 'The record has been modified elsewhere. Please refresh and try again.',
  },
  PET_ID_INVALID: {
    field: 'petId',
    i18nKey: 'errors.validation.invalidPetId',
    fallback: 'Please select a valid pet',
  },
  VET_ID_REQUIRED: {
    field: 'vetId',
    i18nKey: 'errors.validation.invalidVetId',
    fallback: 'Please select a valid veterinarian',
  },
  DATE_REQUIRED: {
    field: 'date',
    i18nKey: 'errors.validation.invalidDate',
    fallback: 'Please enter a valid date',
  },
};

export function mapServerValidationError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string = (k) => k,
): ServerValidationResult {
  const fieldErrors: Record<string, string> = {};
  let globalError: string | null = null;

  if (error === null || error === undefined) {
    return { fieldErrors, globalError: getErrorMessage(error, t) };
  }

  // Extract response data if AxiosError
  let data: any = error;
  if (error instanceof Error) {
    if ('response' in error && (error as AxiosError).response?.data) {
      data = (error as AxiosError).response?.data;
    } else if (error instanceof ApiError) {
      return {
        fieldErrors,
        globalError: t(error.key, error.params) || error.message,
      };
    } else {
      data = error.message;
    }
  }

  // If data is primitive (string, number, boolean)
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    const str = String(data);
    const mapped = STABLE_ERROR_CODE_MAP[str.toUpperCase()];
    if (mapped) {
      const translated = t(mapped.i18nKey);
      fieldErrors[mapped.field] = translated !== mapped.i18nKey ? translated : mapped.fallback;
    } else {
      globalError = str;
    }
    return { fieldErrors, globalError };
  }

  if (typeof data !== 'object' || data === null) {
    return { fieldErrors, globalError: getErrorMessage(error, t) };
  }

  // 1. Check for fieldErrors record: { fieldErrors: { 'pet.name': '...' } }
  if (data.fieldErrors && typeof data.fieldErrors === 'object' && data.fieldErrors !== null) {
    for (const [field, val] of Object.entries(data.fieldErrors)) {
      if (typeof val === 'string') {
        const mappedCode = STABLE_ERROR_CODE_MAP[val.toUpperCase()];
        if (mappedCode) {
          const translated = t(mappedCode.i18nKey);
          fieldErrors[field] = translated !== mappedCode.i18nKey ? translated : mappedCode.fallback;
        } else {
          fieldErrors[field] = val;
        }
      } else if (val && typeof val === 'object') {
        const item = val as ServerValidationErrorItem;
        const msg =
          item.message ||
          (item.code && STABLE_ERROR_CODE_MAP[item.code.toUpperCase()]?.fallback) ||
          JSON.stringify(val);
        fieldErrors[field] = typeof msg === 'string' ? msg : JSON.stringify(msg);
      }
    }
  }

  // 2. Check for errors array: { errors: [{ field: '...', code: '...', message: '...' }] }
  if (Array.isArray(data.errors)) {
    for (const errItem of data.errors) {
      if (errItem && typeof errItem === 'object') {
        const field = errItem.field || errItem.path;
        const code = errItem.code;
        const message = errItem.message;

        if (field) {
          let resolvedMsg = message;
          if (code && STABLE_ERROR_CODE_MAP[code.toUpperCase()]) {
            const mapped = STABLE_ERROR_CODE_MAP[code.toUpperCase()];
            const translated = t(mapped.i18nKey);
            resolvedMsg = translated !== mapped.i18nKey ? translated : (message || mapped.fallback);
          } else if (!resolvedMsg && code) {
            resolvedMsg = code;
          }
          fieldErrors[field] = resolvedMsg || 'Invalid value';
        } else if (code && STABLE_ERROR_CODE_MAP[code.toUpperCase()]) {
          const mapped = STABLE_ERROR_CODE_MAP[code.toUpperCase()];
          const translated = t(mapped.i18nKey);
          fieldErrors[mapped.field] = translated !== mapped.i18nKey ? translated : (message || mapped.fallback);
        }
      } else if (typeof errItem === 'string') {
        const mapped = STABLE_ERROR_CODE_MAP[errItem.toUpperCase()];
        if (mapped) {
          const translated = t(mapped.i18nKey);
          fieldErrors[mapped.field] = translated !== mapped.i18nKey ? translated : mapped.fallback;
        } else {
          globalError = globalError ? `${globalError}; ${errItem}` : errItem;
        }
      }
    }
  }

  // 3. Check for single field, code, message at top level of data
  const topField = data.field || data.path;
  const topCode = data.code;
  const topMessage = data.message;

  if (topField && (topCode || topMessage)) {
    let resolvedMsg = topMessage;
    if (topCode && STABLE_ERROR_CODE_MAP[topCode.toUpperCase()]) {
      const mapped = STABLE_ERROR_CODE_MAP[topCode.toUpperCase()];
      const translated = t(mapped.i18nKey);
      resolvedMsg = translated !== mapped.i18nKey ? translated : (topMessage || mapped.fallback);
    }
    fieldErrors[topField] = resolvedMsg || topCode || 'Invalid value';
  } else if (topCode && STABLE_ERROR_CODE_MAP[topCode.toUpperCase()]) {
    const mapped = STABLE_ERROR_CODE_MAP[topCode.toUpperCase()];
    const translated = t(mapped.i18nKey);
    fieldErrors[mapped.field] = translated !== mapped.i18nKey ? translated : (topMessage || mapped.fallback);
  }

  // 4. Check if message is an array
  if (Array.isArray(topMessage)) {
    for (const msg of topMessage) {
      if (typeof msg === 'string') {
        globalError = globalError ? `${globalError}; ${msg}` : msg;
      }
    }
  } else if (typeof topMessage === 'string' && Object.keys(fieldErrors).length === 0) {
    const mapped = STABLE_ERROR_CODE_MAP[topMessage.toUpperCase()];
    if (mapped) {
      const translated = t(mapped.i18nKey);
      fieldErrors[mapped.field] = translated !== mapped.i18nKey ? translated : mapped.fallback;
    } else {
      globalError = topMessage;
    }
  }

  // If still no fieldErrors and no globalError, use fallback
  if (Object.keys(fieldErrors).length === 0 && !globalError) {
    globalError = getErrorMessage(error, t);
  }

  return { fieldErrors, globalError };
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
