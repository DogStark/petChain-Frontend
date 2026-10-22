export interface UnitConversion {
  analyte: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  offset?: number;
  source: string;
}

export interface ConvertedResult {
  originalValue: number;
  originalUnit: string;
  convertedValue: number;
  convertedUnit: string;
  source: string;
}

const CONVERSIONS: UnitConversion[] = [
  {
    analyte: 'glucose',
    fromUnit: 'mg/dL',
    toUnit: 'mmol/L',
    factor: 0.0555,
    source: 'SI conversion (molar mass 180.16 g/mol)',
  },
  {
    analyte: 'glucose',
    fromUnit: 'mmol/L',
    toUnit: 'mg/dL',
    factor: 18.0182,
    source: 'SI conversion (molar mass 180.16 g/mol)',
  },
  {
    analyte: 'cholesterol',
    fromUnit: 'mg/dL',
    toUnit: 'mmol/L',
    factor: 0.02586,
    source: 'SI conversion (molar mass 386.65 g/mol)',
  },
  {
    analyte: 'cholesterol',
    fromUnit: 'mmol/L',
    toUnit: 'mg/dL',
    factor: 38.67,
    source: 'SI conversion (molar mass 386.65 g/mol)',
  },
  {
    analyte: 'creatinine',
    fromUnit: 'mg/dL',
    toUnit: 'umol/L',
    factor: 88.4,
    source: 'SI conversion (molar mass 113.12 g/mol)',
  },
  {
    analyte: 'creatinine',
    fromUnit: 'umol/L',
    toUnit: 'mg/dL',
    factor: 0.0113,
    source: 'SI conversion (molar mass 113.12 g/mol)',
  },
  {
    analyte: 'hemoglobin',
    fromUnit: 'g/dL',
    toUnit: 'g/L',
    factor: 10,
    source: 'SI conversion (decimal shift)',
  },
  {
    analyte: 'hemoglobin',
    fromUnit: 'g/L',
    toUnit: 'g/dL',
    factor: 0.1,
    source: 'SI conversion (decimal shift)',
  },
  {
    analyte: 'calcium',
    fromUnit: 'mg/dL',
    toUnit: 'mmol/L',
    factor: 0.2495,
    source: 'SI conversion (molar mass 40.08 g/mol)',
  },
  {
    analyte: 'calcium',
    fromUnit: 'mmol/L',
    toUnit: 'mg/dL',
    factor: 4.008,
    source: 'SI conversion (molar mass 40.08 g/mol)',
  },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function findConversion(
  analyte: string,
  fromUnit: string,
): UnitConversion | undefined {
  const normalizedAnalyte = normalize(analyte);
  const normalizedUnit = normalize(fromUnit);
  return CONVERSIONS.find(
    (conversion) =>
      normalize(conversion.analyte) === normalizedAnalyte &&
      normalize(conversion.fromUnit) === normalizedUnit,
  );
}

export function convertResult(
  analyte: string,
  value: number,
  fromUnit: string,
): ConvertedResult | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const conversion = findConversion(analyte, fromUnit);
  if (!conversion) {
    return null;
  }

  const convertedValue = value * conversion.factor + (conversion.offset ?? 0);

  return {
    originalValue: value,
    originalUnit: fromUnit,
    convertedValue,
    convertedUnit: conversion.toUnit,
    source: conversion.source,
  };
}

export function formatConvertedResult(result: ConvertedResult): string {
  const converted = Number(result.convertedValue.toFixed(2));
  return `${result.originalValue} ${result.originalUnit} (${converted} ${result.convertedUnit})`;
}
