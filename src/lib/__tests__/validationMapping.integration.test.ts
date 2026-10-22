import { mapServerValidationError } from '../validationMapping';

describe('validationMapping integration with Appointment booking', () => {
  const mockTranslate = (key: string) => {
    const translations: Record<string, string> = {
      'errors.api.validation.petNameRequired': 'Pet name is required (localized)',
      'errors.api.validation.invalidDosage': 'Invalid dosage (localized)',
      'errors.api.validation.appointmentConflict': 'Slot taken (localized)',
      'errors.api.validation.staleVersion': 'Stale version (localized)',
      'errors.general.unknown': 'Unknown error occurred',
    };
    return translations[key] || key;
  };

  it('maps 409 conflict with availableSlots to field error', () => {
    const axiosError = {
      response: {
        status: 409,
        data: {
          message: 'The selected time slot is no longer available.',
          availableSlots: ['10:00', '11:00'],
        },
      },
    };

    const result = mapServerValidationError(axiosError, mockTranslate);
    expect(result.fieldErrors).toEqual({
      'appointment.date': 'Slot taken (localized)',
    });
    expect(result.globalError).toBeNull();
  });

  it('maps code SLOT_TAKEN to appointment.date field', () => {
    const axiosError = {
      response: {
        data: {
          code: 'SLOT_TAKEN',
          message: 'Time slot already booked',
        },
      },
    };

    const result = mapServerValidationError(axiosError, mockTranslate);
    expect(result.fieldErrors).toEqual({
      'appointment.date': 'Slot taken (localized)',
    });
  });

  it('maps pet.id validation error from backend class-validator', () => {
    const axiosError = {
      response: {
        data: {
          errors: [
            { field: 'petId', code: 'PET_ID_INVALID', message: 'petId must be a UUID' },
          ],
        },
      },
    };

    const result = mapServerValidationError(axiosError, mockTranslate);
    expect(result.fieldErrors).toEqual({
      petId: 'Please select a valid pet',
    });
  });
});