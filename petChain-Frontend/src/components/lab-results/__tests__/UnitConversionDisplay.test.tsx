import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnitConversionDisplay, findConversion, convertValue } from '../UnitConversionDisplay';

describe('UnitConversionDisplay', () => {
  it('shows converted value, original value, and source for a supported conversion', () => {
    render(<UnitConversionDisplay analyte="glucose" value={100} unit="mg/dL" />);
    expect(screen.getByLabelText('Original value 100 mg/dL')).toBeInTheDocument();
    expect(screen.getByLabelText('Converted value 5.55 mmol/L')).toBeInTheDocument();
    expect(screen.getByLabelText(/Conversion source:/)).toBeInTheDocument();
  });

  it('shows only the original value when no conversion is supported', () => {
    render(<UnitConversionDisplay analyte="unknown" value={42} unit="xyz" />);
    expect(screen.getByText('42 xyz')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Converted value/)).not.toBeInTheDocument();
  });

  it('shows only the original value for non-finite values', () => {
    render(<UnitConversionDisplay analyte="glucose" value={NaN} unit="mg/dL" />);
    expect(screen.queryByLabelText(/Converted value/)).not.toBeInTheDocument();
  });

  it('handles temperature conversions with an offset', () => {
    const conversion = findConversion('temperature', 'C');
    expect(conversion).toBeDefined();
    expect(convertValue(0, conversion!)).toBe(32);
  });

  it('matches analyte and unit case-insensitively', () => {
    expect(findConversion('Glucose', 'MG/DL')).toBeDefined();
  });
});
