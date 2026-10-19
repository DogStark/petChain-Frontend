import {
  isFutureDate,
  isBeforeBirth,
  isAfterExpiry,
  validateNotFuture,
  validateAfterBirth,
  validateBeforeExpiry,
  validateDateOrdering,
} from './dateValidation';

const today = new Date();
const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

const yesterday = new Date(today);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;

const tomorrow = new Date(today);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const tomorrowStr = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;

describe('isFutureDate', () => {
  it('returns false for today', () => {
    expect(isFutureDate(todayStr)).toBe(false);
  });

  it('returns false for yesterday', () => {
    expect(isFutureDate(yesterdayStr)).toBe(false);
  });

  it('returns true for tomorrow', () => {
    expect(isFutureDate(tomorrowStr)).toBe(true);
  });

  it('returns false for a past date', () => {
    expect(isFutureDate('2020-01-01')).toBe(false);
  });

  it('returns true for a future date', () => {
    expect(isFutureDate('2099-12-31')).toBe(true);
  });
});

describe('isBeforeBirth', () => {
  it('returns false when date equals birth date', () => {
    expect(isBeforeBirth('2020-01-01', '2020-01-01')).toBe(false);
  });

  it('returns false when date is after birth date', () => {
    expect(isBeforeBirth('2020-06-15', '2020-01-01')).toBe(false);
  });

  it('returns true when date is before birth date', () => {
    expect(isBeforeBirth('2019-12-31', '2020-01-01')).toBe(true);
  });
});

describe('isAfterExpiry', () => {
  it('returns false when date equals expiry date', () => {
    expect(isAfterExpiry('2020-01-01', '2020-01-01')).toBe(false);
  });

  it('returns false when date is before expiry date', () => {
    expect(isAfterExpiry('2019-06-15', '2020-01-01')).toBe(false);
  });

  it('returns true when date is after expiry date', () => {
    expect(isAfterExpiry('2020-01-02', '2020-01-01')).toBe(true);
  });
});

describe('validateNotFuture', () => {
  it('returns null for today', () => {
    expect(validateNotFuture(todayStr, 'Surgery date')).toBeNull();
  });

  it('returns null for a past date', () => {
    expect(validateNotFuture('2020-01-01', 'Surgery date')).toBeNull();
  });

  it('returns an error for a future date', () => {
    expect(validateNotFuture(tomorrowStr, 'Surgery date')).toBe(
      'Surgery date cannot be in the future',
    );
  });

  it('returns null when date is empty', () => {
    expect(validateNotFuture('', 'Surgery date')).toBeNull();
  });
});

describe('validateAfterBirth', () => {
  it('returns null when date equals birth date', () => {
    expect(validateAfterBirth('2020-01-01', '2020-01-01', 'Visit date')).toBeNull();
  });

  it('returns null when date is after birth date', () => {
    expect(validateAfterBirth('2020-06-15', '2020-01-01', 'Visit date')).toBeNull();
  });

  it('returns an error when date is before birth date', () => {
    expect(validateAfterBirth('2019-12-31', '2020-01-01', 'Visit date')).toBe(
      'Visit date must be after the pet\'s birth date',
    );
  });

  it('returns null when either date is empty', () => {
    expect(validateAfterBirth('', '2020-01-01', 'Visit date')).toBeNull();
    expect(validateAfterBirth('2020-01-01', '', 'Visit date')).toBeNull();
  });
});

describe('validateBeforeExpiry', () => {
  it('returns null when date equals expiry date', () => {
    expect(validateBeforeExpiry('2020-01-01', '2020-01-01', 'Treatment date')).toBeNull();
  });

  it('returns null when date is before expiry date', () => {
    expect(validateBeforeExpiry('2019-06-15', '2020-01-01', 'Treatment date')).toBeNull();
  });

  it('returns an error when date is after expiry date', () => {
    expect(validateBeforeExpiry('2020-01-02', '2020-01-01', 'Treatment date')).toBe(
      'Treatment date must be before the expiry date',
    );
  });

  it('returns null when either date is empty', () => {
    expect(validateBeforeExpiry('', '2020-01-01', 'Treatment date')).toBeNull();
    expect(validateBeforeExpiry('2020-01-01', '', 'Treatment date')).toBeNull();
  });
});

describe('validateDateOrdering', () => {
  it('returns empty object for a single date', () => {
    expect(validateDateOrdering({ visitDate: '2020-01-01' })).toEqual({});
  });

  it('returns empty object for dates in correct order', () => {
    expect(
      validateDateOrdering({
        birthDate: '2018-01-01',
        visitDate: '2020-06-15',
        diagnosisDate: '2020-06-16',
      }),
    ).toEqual({});
  });

  it('returns an error when a date is before the previous date', () => {
    const result = validateDateOrdering({
      visitDate: '2020-06-15',
      diagnosisDate: '2020-06-14',
    });
    expect(result).toHaveProperty('diagnosisDate');
    expect(result.diagnosisDate).toMatch(/diagnosisDate must be on or after visitDate/);
  });

  it('returns an error for equal boundary dates (exact boundary is allowed)', () => {
    expect(
      validateDateOrdering({
        visitDate: '2020-06-15',
        diagnosisDate: '2020-06-15',
      }),
    ).toEqual({});
  });

  it('returns empty object when some dates are empty', () => {
    expect(
      validateDateOrdering({
        visitDate: '',
        diagnosisDate: '2020-06-15',
      }),
    ).toEqual({});
  });
});
