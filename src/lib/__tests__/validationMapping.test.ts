import { mapServerValidationError, focusFirstInvalidField } from '../validationMapping';
import { ApiError } from '../apiError';
import { AxiosError } from 'axios';

describe('validationMapping', () => {
  const mockTranslate = (key: string) => {
    const translations: Record<string, string> = {
      'errors.validation.petNameRequired': 'Pet name is required (localized)',
      'errors.validation.invalidDosage': 'Invalid dosage (localized)',
      'errors.validation.appointmentConflict': 'Slot taken (localized)',
      'errors.validation.staleVersion': 'Stale version (localized)',
      'errors.general.unknown': 'Unknown error occurred',
    };
    return translations[key] || key;
  };

  describe('mapServerValidationError', () => {
    it('handles nested fields correctly', () => {
      const error = {
        response: {
          data: {
            errors: [
              { field: 'pet.medicalHistory.diagnosis', code: 'REQUIRED', message: 'Diagnosis is required' },
            ],
          },
        },
      };

      const result = mapServerValidationError(error, mockTranslate);
      expect(result.fieldErrors).toEqual({
        'pet.medicalHistory.diagnosis': 'Diagnosis is required',
      });
      expect(result.globalError).toBeNull();
    });

    it('handles array items correctly', () => {
      const error = {
        response: {
          data: {
            fieldErrors: {
              'dosages[0].amount': 'INVALID_DOSAGE',
              'medications.1.name': 'Medication name is required',
            },
          },
        },
      };

      const result = mapServerValidationError(error, mockTranslate);
      expect(result.fieldErrors).toEqual({
        'dosages[0].amount': 'Invalid dosage (localized)',
        'medications.1.name': 'Medication name is required',
      });
    });

    it('handles stale versions and concurrency conflicts', () => {
      const error = {
        response: {
          data: {
            code: 'STALE_VERSION',
          },
        },
      };

      const result = mapServerValidationError(error, mockTranslate);
      expect(result.fieldErrors).toEqual({
        version: 'Stale version (localized)',
      });
    });

    it('handles stable error codes mapped to fields and messages', () => {
      const error = {
        response: {
          data: {
            code: 'PET_NAME_REQUIRED',
          },
        },
      };

      const result = mapServerValidationError(error, mockTranslate);
      expect(result.fieldErrors).toEqual({
        'pet.name': 'Pet name is required (localized)',
      });
    });

    it('retains safe global fallback for unknown or unmapped errors', () => {
      const error = new Error('Database connection timeout 500');
      const result = mapServerValidationError(error, mockTranslate);
      expect(result.fieldErrors).toEqual({});
      expect(result.globalError).toBe('Unknown error occurred');
    });

    it('handles malformed error payloads safely', () => {
      const malformedPayloads = [
        null,
        undefined,
        'Raw string error without code',
        12345,
        true,
        { invalidProp: true },
        { errors: 'not an array' },
        { message: null },
      ];

      for (const payload of malformedPayloads) {
        const result = mapServerValidationError(payload, mockTranslate);
        expect(result).toHaveProperty('fieldErrors');
        expect(result).toHaveProperty('globalError');
        expect(typeof result.fieldErrors).toBe('object');
      }
    });

    it('handles ApiError instances', () => {
      const apiErr = new ApiError('errors.twoFactor.invalidToken', 'Fallback token');
      const result = mapServerValidationError(apiErr, mockTranslate);
      expect(result.globalError).toBe('errors.twoFactor.invalidToken');
    });
  });

  describe('focusFirstInvalidField', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <form>
          <input name="pet.name" type="text" />
          <input name="dosages[0].amount" type="text" />
          <input name="version" type="hidden" />
        </form>
      `;
    });

    it('focuses the first invalid field and sets aria-invalid', () => {
      const fieldErrors = {
        'pet.name': 'Required',
        'dosages[0].amount': 'Invalid',
      };

      const focused = focusFirstInvalidField(fieldErrors);
      expect(focused).toBe(true);

      const petNameInput = document.querySelector('[name="pet.name"]') as HTMLElement;
      expect(document.activeElement).toBe(petNameInput);
      expect(petNameInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('returns false when no matching elements exist', () => {
      const fieldErrors = {
        'nonexistent.field': 'Error',
      };

      const focused = focusFirstInvalidField(fieldErrors);
      expect(focused).toBe(false);
    });

    it('handles array item selectors correctly', () => {
      const fieldErrors = {
        'dosages[0].amount': 'Invalid amount',
      };

      const focused = focusFirstInvalidField(fieldErrors);
      expect(focused).toBe(true);

      const dosageInput = document.querySelector('[name="dosages[0].amount"]') as HTMLElement;
      expect(document.activeElement).toBe(dosageInput);
    });
  });
});