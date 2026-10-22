import React from 'react';

export interface UnitConversion {
  analyte: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  offset?: number;
  source: string;
}

const CONVERSIONS: UnitConversion[] = [
  { analyte: 'glucose', fromUnit: 'mg/dL', toUnit: 'mmol/L', factor: 0.0555, source: 'SI conversion (molar mass 180.16 g/mol)' },
  { analyte: 'glucose', fromUnit: 'mmol/L', toUnit: 'mg/dL', factor: 18.0182, source: 'SI conversion (molar mass 180.16 g/mol)' },
  { analyte: 'cholesterol', fromUnit: 'mg/dL', toUnit: 'mmol/L', factor: 0.02586, source: 'SI conversion (molar mass 386.65 g/mol)' },
  { analyte: 'cholesterol', fromUnit: 'mmol/L', toUnit: 'mg/dL', factor: 38.67, source: 'SI conversion (molar mass 386.65 g/mol)' },
  { analyte: 'creatinine', fromUnit: 'mg/dL', toUnit: 'umol/L', factor: 88.4, source: 'SI conversion (molar mass 113.12 g/mol)' },
  { analyte: 'creatinine', fromUnit: 'umol/L', toUnit: 'mg/dL', factor: 0.0113, source: 'SI conversion (molar mass 113.12 g/mol)' },
  { analyte: 'hemoglobin', fromUnit: 'g/dL', toUnit: 'g/L', factor: 10, source: 'SI prefix conversion' },
  { analyte: 'hemoglobin', fromUnit: 'g/L', toUnit: 'g/dL', factor: 0.1, source: 'SI prefix conversion' },
  { analyte: 'temperature', fromUnit: 'C', toUnit: 'F', factor: 1.8, offset: 32, source: 'Temperature scale conversion' },
  { analyte: 'temperature', fromUnit: 'F', toUnit: 'C', factor: 0.5556, offset: -17.7778, source: 'Temperature scale conversion' },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function findConversion(analyte: string, fromUnit: string): UnitConversion | undefined {
  const a = normalize(analyte);
  const u = normalize(fromUnit);
  return CONVERSIONS.find((c) => normalize(c.analyte) === a && normalize(c.fromUnit) === u);
}

export function convertValue(value: number, conversion: UnitConversion): number {
  const converted = value * conversion.factor + (conversion.offset ?? 0);
  return Math.round(converted * 100) / 100;
}

export interface UnitConversionDisplayProps {
  analyte: string;
  value: number;
  unit: string;
}

export function UnitConversionDisplay({ analyte, value, unit }: UnitConversionDisplayProps) {
  const conversion = findConversion(analyte, unit);

  if (!conversion || !Number.isFinite(value)) {
    return (
      <span className="lab-result-value">
        {value} {unit}
      </span>
    );
  }

  const converted = convertValue(value, conversion);

  return (
    <span className="lab-result-value">
      <span aria-label={`Original value ${value} ${unit}`}>
        {value} {unit}
      </span>
      <span className="lab-result-converted" aria-label={`Converted value ${converted} ${conversion.toUnit}`}>
        {' '}({converted} {conversion.toUnit})
      </span>
      <span className="lab-result-conversion-source" aria-label={`Conversion source: ${conversion.source}`}>
        {' '}— {conversion.source}
      </span>
    </span>
  );
}

export default UnitConversionDisplay;
