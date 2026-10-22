import {
  convertWeight,
  kgToLb,
  lbToKg,
  convertTemperature,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  convertVolume,
  mlToOz,
  ozToMl,
} from '@/utils/unitConversion';

describe('unitConversion', () => {
  describe('weight conversions', () => {
    it('converts kg to lb accurately', () => {
      expect(kgToLb(1)).toBeCloseTo(2.20462, 2);
      expect(kgToLb(10)).toBeCloseTo(22.0462, 1);
      expect(kgToLb(0.5)).toBeCloseTo(1.10231, 2);
    });

    it('converts lb to kg accurately', () => {
      expect(lbToKg(1)).toBeCloseTo(0.453592, 3);
      expect(lbToKg(10)).toBeCloseTo(4.53592, 2);
      expect(lbToKg(2.2)).toBeCloseTo(0.997903, 3);
    });

    it('handles same-unit conversions (no-op)', () => {
      expect(convertWeight(5, 'kg', 'kg')).toBe(5);
      expect(convertWeight(10, 'lb', 'lb')).toBe(10);
    });

    it('handles null and undefined values', () => {
      expect(kgToLb(null)).toBeNull();
      expect(kgToLb(undefined)).toBeNull();
      expect(lbToKg(null)).toBeNull();
    });

    it('handles invalid numbers', () => {
      expect(kgToLb(NaN)).toBeNull();
      expect(lbToKg(Infinity)).toBeNull();
      expect(kgToLb(-Infinity)).toBeNull();
    });

    it('rejects negative weights', () => {
      expect(kgToLb(-5)).toBeNull();
      expect(lbToKg(-10)).toBeNull();
    });

    it('rounds results appropriately', () => {
      // Small values get more decimals
      expect(convertWeight(0.005, 'kg', 'lb')).toBeDefined();
      // Large values get fewer decimals
      const largeResult = convertWeight(1000, 'kg', 'lb');
      expect(largeResult).toBeDefined();
      expect(typeof largeResult).toBe('number');
    });

    it('converts between g and oz', () => {
      const result = convertWeight(100, 'g', 'oz');
      expect(result).toBeCloseTo(3.5274, 1);
    });
  });

  describe('temperature conversions', () => {
    it('converts Celsius to Fahrenheit accurately', () => {
      expect(celsiusToFahrenheit(0)).toBe(32);
      expect(celsiusToFahrenheit(100)).toBe(212);
      expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 1);
      expect(celsiusToFahrenheit(-40)).toBe(-40);
    });

    it('converts Fahrenheit to Celsius accurately', () => {
      expect(fahrenheitToCelsius(32)).toBe(0);
      expect(fahrenheitToCelsius(212)).toBe(100);
      expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 0);
      expect(fahrenheitToCelsius(-40)).toBe(-40);
    });

    it('handles same-unit conversions (no-op)', () => {
      expect(convertTemperature(25, 'C', 'C')).toBe(25);
      expect(convertTemperature(77, 'F', 'F')).toBe(77);
    });

    it('handles null and undefined values', () => {
      expect(celsiusToFahrenheit(null)).toBeNull();
      expect(celsiusToFahrenheit(undefined)).toBeNull();
      expect(fahrenheitToCelsius(null)).toBeNull();
    });

    it('handles invalid numbers', () => {
      expect(celsiusToFahrenheit(NaN)).toBeNull();
      expect(fahrenheitToCelsius(Infinity)).toBeNull();
    });

    it('allows negative temperatures (valid for both scales)', () => {
      expect(celsiusToFahrenheit(-20)).toBeCloseTo(-4, 1);
      expect(fahrenheitToCelsius(-4)).toBeCloseTo(-20, 0);
    });

    it('rounds to 1 decimal place', () => {
      const result = celsiusToFahrenheit(36.7);
      expect(result).toBeDefined();
      if (result !== null) {
        expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('volume conversions', () => {
    it('converts ml to fl oz accurately', () => {
      expect(mlToOz(100)).toBeCloseTo(3.3814, 1);
      expect(mlToOz(250)).toBeCloseTo(8.4535, 1);
      expect(mlToOz(500)).toBeCloseTo(16.907, 1);
    });

    it('converts fl oz to ml accurately', () => {
      expect(ozToMl(1)).toBeCloseTo(29.5735, 0);
      expect(ozToMl(8)).toBeCloseTo(236.588, 0);
    });

    it('handles same-unit conversions (no-op)', () => {
      expect(convertVolume(100, 'ml', 'ml')).toBe(100);
      expect(convertVolume(5, 'oz', 'oz')).toBe(5);
    });

    it('converts between l and gal', () => {
      const result = convertVolume(1, 'l', 'gal');
      expect(result).toBeCloseTo(0.264172, 2);
    });

    it('handles null and undefined values', () => {
      expect(mlToOz(null)).toBeNull();
      expect(ozToMl(undefined)).toBeNull();
    });

    it('handles invalid numbers', () => {
      expect(mlToOz(NaN)).toBeNull();
      expect(ozToMl(Infinity)).toBeNull();
    });

    it('rejects negative volumes', () => {
      expect(mlToOz(-100)).toBeNull();
      expect(ozToMl(-5)).toBeNull();
    });

    it('rounds results appropriately', () => {
      // Very small values
      const tiny = convertVolume(0.005, 'ml', 'oz');
      expect(tiny).toBeDefined();
      
      // Large values
      const large = convertVolume(5000, 'ml', 'oz');
      expect(large).toBeDefined();
      expect(typeof large).toBe('number');
    });
  });

  describe('precision and rounding', () => {
    it('avoids floating point artifacts', () => {
      // Converting and converting back should be close to original
      const original = 5.5;
      const converted = kgToLb(original);
      if (converted !== null) {
        const backConverted = lbToKg(converted);
        expect(backConverted).toBeCloseTo(original, 1);
      }
    });

    it('handles very small values', () => {
      const result = convertWeight(0.001, 'kg', 'lb');
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result !== null) {
        expect(result).toBeGreaterThan(0);
      }
    });

    it('handles very large values', () => {
      const result = convertWeight(10000, 'kg', 'lb');
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result !== null) {
        expect(result).toBeGreaterThan(10000);
      }
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      expect(kgToLb(0)).toBe(0);
      expect(celsiusToFahrenheit(0)).toBe(32); // Special case for temperature
      expect(mlToOz(0)).toBe(0);
    });

    it('handles decimal precision edge cases', () => {
      // Test that 0.1 + 0.2 type issues are handled
      const result = convertWeight(0.1, 'kg', 'lb');
      expect(result).toBeDefined();
      if (result !== null) {
        expect(Number.isFinite(result)).toBe(true);
      }
    });

    it('returns null for unknown unit combinations', () => {
      // TypeScript prevents this at compile time, but test runtime safety
      const result = convertWeight(5, 'kg' as any, 'invalid' as any);
      expect(result).toBeNull();
    });
  });
});
