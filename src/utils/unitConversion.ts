/**
 * Unit conversion utilities for measurements.
 * All functions are pure and handle edge cases (null, undefined, NaN, negative).
 */

export type WeightUnit = 'kg' | 'lb' | 'g' | 'oz';
export type TemperatureUnit = 'C' | 'F';
export type VolumeUnit = 'ml' | 'l' | 'oz' | 'gal';

// ─── Conversion constants ──────────────────────────────────────────────────────

const KG_TO_LB = 2.20462;
const LB_TO_KG = 1 / KG_TO_LB;
const G_TO_OZ = 0.035274;
const OZ_TO_G = 1 / G_TO_OZ;
const ML_TO_FL_OZ = 0.033814;
const FL_OZ_TO_ML = 1 / ML_TO_FL_OZ;
const L_TO_GAL = 0.264172;
const GAL_TO_L = 1 / L_TO_GAL;

// ─── Safe number validation ────────────────────────────────────────────────────

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

function safeRound(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Weight conversions ────────────────────────────────────────────────────────

export function convertWeight(
  value: number | null | undefined,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number | null {
  if (!isValidNumber(value)) return null;
  if (value < 0) return null; // Negative weights are invalid
  if (fromUnit === toUnit) return value;
  
  // Convert to kg as base unit
  let kg: number;
  switch (fromUnit) {
    case 'kg':
      kg = value;
      break;
    case 'lb':
      kg = value * LB_TO_KG;
      break;
    case 'g':
      kg = value / 1000;
      break;
    case 'oz':
      kg = value * OZ_TO_G / 1000;
      break;
    default:
      return null;
  }
  
  // Convert from kg to target unit
  let result: number;
  switch (toUnit) {
    case 'kg':
      result = kg;
      break;
    case 'lb':
      result = kg * KG_TO_LB;
      break;
    case 'g':
      result = kg * 1000;
      break;
    case 'oz':
      result = kg * 1000 * G_TO_OZ;
      break;
    default:
      return null;
  }
  
  // Round based on magnitude
  if (result < 0.01) return safeRound(result, 4);
  if (result < 1) return safeRound(result, 3);
  if (result < 10) return safeRound(result, 2);
  if (result < 100) return safeRound(result, 1);
  return safeRound(result, 0);
}

export function kgToLb(kg: number | null | undefined): number | null {
  return convertWeight(kg, 'kg', 'lb');
}

export function lbToKg(lb: number | null | undefined): number | null {
  return convertWeight(lb, 'lb', 'kg');
}

// ─── Temperature conversions ───────────────────────────────────────────────────

export function convertTemperature(
  value: number | null | undefined,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit
): number | null {
  if (!isValidNumber(value)) return null;
  if (fromUnit === toUnit) return value;
  
  let result: number;
  if (fromUnit === 'C' && toUnit === 'F') {
    result = (value * 9 / 5) + 32;
  } else if (fromUnit === 'F' && toUnit === 'C') {
    result = (value - 32) * 5 / 9;
  } else {
    return null;
  }
  
  return safeRound(result, 1);
}

export function celsiusToFahrenheit(celsius: number | null | undefined): number | null {
  return convertTemperature(celsius, 'C', 'F');
}

export function fahrenheitToCelsius(fahrenheit: number | null | undefined): number | null {
  return convertTemperature(fahrenheit, 'F', 'C');
}

// ─── Volume conversions ────────────────────────────────────────────────────────

export function convertVolume(
  value: number | null | undefined,
  fromUnit: VolumeUnit,
  toUnit: VolumeUnit
): number | null {
  if (!isValidNumber(value)) return null;
  if (value < 0) return null; // Negative volumes are invalid
  if (fromUnit === toUnit) return value;
  
  // Convert to ml as base unit
  let ml: number;
  switch (fromUnit) {
    case 'ml':
      ml = value;
      break;
    case 'l':
      ml = value * 1000;
      break;
    case 'oz':
      ml = value * FL_OZ_TO_ML;
      break;
    case 'gal':
      ml = value * GAL_TO_L * 1000;
      break;
    default:
      return null;
  }
  
  // Convert from ml to target unit
  let result: number;
  switch (toUnit) {
    case 'ml':
      result = ml;
      break;
    case 'l':
      result = ml / 1000;
      break;
    case 'oz':
      result = ml * ML_TO_FL_OZ;
      break;
    case 'gal':
      result = ml / 1000 * L_TO_GAL;
      break;
    default:
      return null;
  }
  
  // Round based on magnitude
  if (result < 0.01) return safeRound(result, 4);
  if (result < 1) return safeRound(result, 3);
  if (result < 10) return safeRound(result, 2);
  if (result < 100) return safeRound(result, 1);
  return safeRound(result, 0);
}

export function mlToOz(ml: number | null | undefined): number | null {
  return convertVolume(ml, 'ml', 'oz');
}

export function ozToMl(oz: number | null | undefined): number | null {
  return convertVolume(oz, 'oz', 'ml');
}
