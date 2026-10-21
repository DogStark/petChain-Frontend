import {
  formatWeight,
  formatTemperature,
  formatVolume,
  formatDosage,
  parseMeasurement,
} from '@/utils/unitFormatting';

describe('unitFormatting', () => {
  describe('formatWeight', () => {
    it('displays explicit unit without conversion', () => {
      expect(formatWeight(5, 'kg', 'customary')).toBe('5 kg');
      expect(formatWeight(10, 'lb', 'metric')).toBe('10 lb');
    });

    it('converts when no explicit unit provided (metric)', () => {
      const result = formatWeight(5, undefined, 'metric');
      expect(result).toContain('kg');
      expect(result).toContain('5');
    });

    it('converts when no explicit unit provided (customary)', () => {
      const result = formatWeight(10, undefined, 'customary');
      expect(result).toContain('lb');
      expect(result).toContain('10');
    });

    it('handles null values', () => {
      expect(formatWeight(null, 'kg')).toBe('—');
      expect(formatWeight(null, undefined, 'metric')).toBe('—');
    });

    it('handles undefined values', () => {
      expect(formatWeight(undefined, 'lb')).toBe('—');
      expect(formatWeight(undefined, undefined, 'customary')).toBe('—');
    });

    it('handles NaN', () => {
      expect(formatWeight(NaN, 'kg')).toBe('Invalid');
      expect(formatWeight(NaN, undefined, 'metric')).toBe('Invalid');
    });

    it('handles negative values', () => {
      expect(formatWeight(-5, 'kg')).toBe('Invalid');
      expect(formatWeight(-10, undefined, 'metric')).toBe('Invalid');
    });

    it('handles Infinity', () => {
      expect(formatWeight(Infinity, 'kg')).toBe('Invalid');
      expect(formatWeight(-Infinity, 'lb')).toBe('Invalid');
    });
  });

  describe('formatTemperature', () => {
    it('displays explicit unit without conversion', () => {
      expect(formatTemperature(37, 'C', 'customary')).toBe('37°C');
      expect(formatTemperature(98.6, 'F', 'metric')).toBe('98.6°F');
    });

    it('converts when no explicit unit provided (metric)', () => {
      const result = formatTemperature(37, undefined, 'metric');
      expect(result).toContain('°C');
      expect(result).toContain('37');
    });

    it('converts when no explicit unit provided (customary)', () => {
      const result = formatTemperature(98, undefined, 'customary');
      expect(result).toContain('°F');
      expect(result).toContain('98');
    });

    it('handles null values', () => {
      expect(formatTemperature(null, 'C')).toBe('—');
      expect(formatTemperature(null, undefined, 'metric')).toBe('—');
    });

    it('handles undefined values', () => {
      expect(formatTemperature(undefined, 'F')).toBe('—');
    });

    it('handles NaN', () => {
      expect(formatTemperature(NaN, 'C')).toBe('Invalid');
    });

    it('allows negative temperatures', () => {
      expect(formatTemperature(-5, 'C', 'metric')).toBe('-5°C');
      expect(formatTemperature(-5, 'F', 'customary')).toBe('-5°F');
    });
  });

  describe('formatVolume', () => {
    it('displays explicit unit without conversion', () => {
      expect(formatVolume(100, 'ml', 'customary')).toBe('100 ml');
      expect(formatVolume(8, 'oz', 'metric')).toBe('8 oz');
    });

    it('converts when no explicit unit provided (metric)', () => {
      const result = formatVolume(100, undefined, 'metric');
      expect(result).toContain('ml');
      expect(result).toContain('100');
    });

    it('converts when no explicit unit provided (customary)', () => {
      const result = formatVolume(8, undefined, 'customary');
      expect(result).toContain('oz');
      expect(result).toContain('8');
    });

    it('handles null values', () => {
      expect(formatVolume(null, 'ml')).toBe('—');
    });

    it('handles undefined values', () => {
      expect(formatVolume(undefined, 'oz')).toBe('—');
    });

    it('handles NaN', () => {
      expect(formatVolume(NaN, 'ml')).toBe('Invalid');
    });

    it('handles negative values', () => {
      expect(formatVolume(-100, 'ml')).toBe('Invalid');
    });
  });

  describe('formatDosage', () => {
    it('formats dosage with default unit (mg)', () => {
      expect(formatDosage(50)).toBe('50.0 mg');
      expect(formatDosage(0.5)).toBe('0.500 mg');
      expect(formatDosage(0.005)).toBe('0.0050 mg');
    });

    it('formats dosage with custom unit', () => {
      expect(formatDosage(5, 'ml')).toContain('ml');
      expect(formatDosage(2, 'tablets')).toContain('tablets');
    });

    it('uses appropriate precision for small values', () => {
      const verySmall = formatDosage(0.0012, 'mg');
      expect(verySmall).toContain('0.0012');
      expect(verySmall).toContain('mg');
    });

    it('uses appropriate precision for large values', () => {
      const large = formatDosage(500, 'mg');
      expect(large).toContain('500');
      expect(large).toContain('mg');
    });

    it('handles null values', () => {
      expect(formatDosage(null)).toBe('—');
    });

    it('handles undefined values', () => {
      expect(formatDosage(undefined)).toBe('—');
    });

    it('handles NaN', () => {
      expect(formatDosage(NaN)).toBe('Invalid');
    });

    it('handles negative values', () => {
      expect(formatDosage(-5)).toBe('Invalid');
    });
  });

  describe('parseMeasurement', () => {
    it('parses measurements with units', () => {
      expect(parseMeasurement('5.5 kg')).toEqual({ value: 5.5, unit: 'kg' });
      expect(parseMeasurement('10 lb')).toEqual({ value: 10, unit: 'lb' });
      expect(parseMeasurement('100 ml')).toEqual({ value: 100, unit: 'ml' });
    });

    it('parses measurements without spaces', () => {
      expect(parseMeasurement('5kg')).toEqual({ value: 5, unit: 'kg' });
      expect(parseMeasurement('10lb')).toEqual({ value: 10, unit: 'lb' });
    });

    it('parses temperature with degree symbol', () => {
      expect(parseMeasurement('37°C')).toEqual({ value: 37, unit: 'C' });
      expect(parseMeasurement('98.6°F')).toEqual({ value: 98.6, unit: 'F' });
      expect(parseMeasurement('37 °C')).toEqual({ value: 37, unit: 'C' });
    });

    it('parses negative values', () => {
      expect(parseMeasurement('-5°C')).toEqual({ value: -5, unit: 'C' });
      expect(parseMeasurement('-20 F')).toEqual({ value: -20, unit: 'F' });
    });

    it('parses decimal values', () => {
      expect(parseMeasurement('5.5 kg')).toEqual({ value: 5.5, unit: 'kg' });
      expect(parseMeasurement('0.5 ml')).toEqual({ value: 0.5, unit: 'ml' });
    });

    it('returns null for invalid inputs', () => {
      expect(parseMeasurement('')).toBeNull();
      expect(parseMeasurement('just text')).toBeNull();
      expect(parseMeasurement('123')).toBeNull(); // No unit
      expect(parseMeasurement('kg')).toBeNull(); // No value
    });

    it('returns null for non-string inputs', () => {
      expect(parseMeasurement(null as any)).toBeNull();
      expect(parseMeasurement(undefined as any)).toBeNull();
      expect(parseMeasurement(123 as any)).toBeNull();
    });

    it('handles extra whitespace', () => {
      expect(parseMeasurement('  5.5  kg  ')).toEqual({ value: 5.5, unit: 'kg' });
    });

    it('parses complex unit abbreviations', () => {
      expect(parseMeasurement('8 fl oz')).toBeNull(); // Space in unit - not supported by current regex
      expect(parseMeasurement('8 oz')).toEqual({ value: 8, unit: 'oz' });
    });
  });

  describe('real-world scenarios', () => {
    it('handles lab result with explicit unit', () => {
      // Lab result comes with explicit kg - should display as-is
      expect(formatWeight(25.5, 'kg', 'customary')).toBe('25.5 kg');
    });

    it('handles user-entered weight without unit (metric pref)', () => {
      // User enters 5, system converts for display based on metric preference
      const result = formatWeight(5, undefined, 'metric');
      expect(result).toContain('kg');
    });

    it('handles user-entered weight without unit (customary pref)', () => {
      // User enters 10, system converts for display based on customary preference
      const result = formatWeight(10, undefined, 'customary');
      expect(result).toContain('lb');
    });

    it('handles temperature reading from different countries', () => {
      // US clinic sends 98.6°F
      expect(formatTemperature(98.6, 'F', 'metric')).toBe('98.6°F');
      
      // French clinic sends 37°C
      expect(formatTemperature(37, 'C', 'customary')).toBe('37°C');
    });

    it('formats medication dosages consistently', () => {
      expect(formatDosage(50, 'mg')).toContain('50');
      expect(formatDosage(5, 'ml')).toContain('5');
      expect(formatDosage(0.5, 'mg')).toContain('0.500');
    });
  });
});
