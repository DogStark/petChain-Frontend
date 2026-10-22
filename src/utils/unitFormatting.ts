import {
  convertWeight,
  convertTemperature,
  convertVolume,
  type WeightUnit,
  type TemperatureUnit,
  type VolumeUnit,
} from './unitConversion';
import type { UnitSystem } from '../hooks/useUnitPreference';

/**
 * Format weight for display, respecting explicit units or converting based on preference.
 * 
 * @param value - Numeric weight value
 * @param explicitUnit - If provided, display this value with this unit (no conversion)
 * @param preferredSystem - User's unit preference (used only when explicitUnit is absent)
 * @returns Formatted string with value and unit, or null/empty indicators
 */
export function formatWeight(
  value: number | null | undefined,
  explicitUnit?: WeightUnit | null,
  preferredSystem: UnitSystem = 'metric'
): string {
  if (value === null || value === undefined) return '—';
  if (isNaN(value) || !isFinite(value)) return 'Invalid';
  if (value < 0) return 'Invalid';
  
  // If explicit unit provided, use it directly (no conversion)
  if (explicitUnit) {
    return `${value} ${explicitUnit}`;
  }
  
  // Otherwise, convert based on preference
  // Default source unit is kg for metric, lb for customary
  const sourceUnit: WeightUnit = preferredSystem === 'metric' ? 'kg' : 'lb';
  const targetUnit: WeightUnit = preferredSystem === 'metric' ? 'kg' : 'lb';
  
  const converted = convertWeight(value, sourceUnit, targetUnit);
  if (converted === null) return 'Invalid';
  
  return `${converted} ${targetUnit}`;
}

/**
 * Format temperature for display, respecting explicit units or converting based on preference.
 * 
 * @param value - Numeric temperature value
 * @param explicitUnit - If provided, display this value with this unit (no conversion)
 * @param preferredSystem - User's unit preference (used only when explicitUnit is absent)
 * @returns Formatted string with value and unit, or null/empty indicators
 */
export function formatTemperature(
  value: number | null | undefined,
  explicitUnit?: TemperatureUnit | null,
  preferredSystem: UnitSystem = 'metric'
): string {
  if (value === null || value === undefined) return '—';
  if (isNaN(value) || !isFinite(value)) return 'Invalid';
  
  // If explicit unit provided, use it directly (no conversion)
  if (explicitUnit) {
    return `${value}°${explicitUnit}`;
  }
  
  // Otherwise, convert based on preference
  const sourceUnit: TemperatureUnit = preferredSystem === 'metric' ? 'C' : 'F';
  const targetUnit: TemperatureUnit = preferredSystem === 'metric' ? 'C' : 'F';
  
  const converted = convertTemperature(value, sourceUnit, targetUnit);
  if (converted === null) return 'Invalid';
  
  return `${converted}°${targetUnit}`;
}

/**
 * Format volume for display, respecting explicit units or converting based on preference.
 * 
 * @param value - Numeric volume value
 * @param explicitUnit - If provided, display this value with this unit (no conversion)
 * @param preferredSystem - User's unit preference (used only when explicitUnit is absent)
 * @returns Formatted string with value and unit, or null/empty indicators
 */
export function formatVolume(
  value: number | null | undefined,
  explicitUnit?: VolumeUnit | null,
  preferredSystem: UnitSystem = 'metric'
): string {
  if (value === null || value === undefined) return '—';
  if (isNaN(value) || !isFinite(value)) return 'Invalid';
  if (value < 0) return 'Invalid';
  
  // If explicit unit provided, use it directly (no conversion)
  if (explicitUnit) {
    return `${value} ${explicitUnit}`;
  }
  
  // Otherwise, convert based on preference
  const sourceUnit: VolumeUnit = preferredSystem === 'metric' ? 'ml' : 'oz';
  const targetUnit: VolumeUnit = preferredSystem === 'metric' ? 'ml' : 'oz';
  
  const converted = convertVolume(value, sourceUnit, targetUnit);
  if (converted === null) return 'Invalid';
  
  return `${converted} ${targetUnit}`;
}

/**
 * Format dosage for display with appropriate unit.
 * Dosages are typically in mg or ml and don't convert between systems.
 * 
 * @param value - Numeric dosage value
 * @param unit - Dosage unit (mg, ml, tablets, etc.)
 * @returns Formatted string with value and unit
 */
export function formatDosage(
  value: number | null | undefined,
  unit: string = 'mg'
): string {
  if (value === null || value === undefined) return '—';
  if (isNaN(value) || !isFinite(value)) return 'Invalid';
  if (value < 0) return 'Invalid';
  
  // Keep dosage precision high for small values
  if (value < 0.01) {
    return `${value.toFixed(4)} ${unit}`;
  } else if (value < 1) {
    return `${value.toFixed(3)} ${unit}`;
  } else if (value < 10) {
    return `${value.toFixed(2)} ${unit}`;
  } else {
    return `${value.toFixed(1)} ${unit}`;
  }
}

/**
 * Parse a measurement string with unit into value and unit components.
 * Handles formats like "5.5 kg", "72°F", "100 ml".
 * 
 * @param input - String to parse
 * @returns Object with numeric value and unit string, or null if unparseable
 */
export function parseMeasurement(
  input: string
): { value: number; unit: string } | null {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  
  // Match patterns like "5.5 kg", "72°F", "100ml"
  const match = trimmed.match(/^([-+]?\d+\.?\d*)\s*([a-zA-Z°]+)$/);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2].replace(/°/g, ''); // Remove degree symbol
  
  if (isNaN(value) || !isFinite(value)) return null;
  
  return { value, unit };
}
