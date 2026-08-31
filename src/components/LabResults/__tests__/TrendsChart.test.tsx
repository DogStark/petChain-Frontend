import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import type { LabResultItem } from '@/types/lab-results';

import TrendsChart from '../TrendsChart';


// Mock ResizeObserver for Recharts ResponsiveContainer in jsdom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('TrendsChart Component', () => {
  describe('Empty and Edge Cases', () => {
    it('renders empty state when data is empty', () => {
      render(<TrendsChart data={[]} />);
      expect(screen.getByText(/No historical data available/i)).toBeInTheDocument();
    });

    it('renders single data point with explanatory note and reference range', () => {
      const singleData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Red Blood Cell Count',
          value: 6.2,
          category: 'Blood Work',
          date: '2024-10-15T10:00:00Z',
          referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
          isAbnormal: false,
        },
      ];

      render(<TrendsChart data={singleData} />);
      expect(screen.getByText(/Single test entry/i)).toBeInTheDocument();
      expect(screen.getByText(/6.2 M\/uL/i)).toBeInTheDocument();
      expect(screen.getByText(/5.5 – 8.5 M\/uL/i)).toBeInTheDocument();
    });

    it('handles missing reference ranges gracefully without crashing', () => {
      const noRangeData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Custom Assay',
          value: 15.0,
          category: 'Other',
          date: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          testName: 'Custom Assay',
          value: 18.5,
          category: 'Other',
          date: '2024-02-01T00:00:00Z',
        },
      ];

      render(<TrendsChart data={noRangeData} />);
      expect(screen.getByText(/No reference range provided/i)).toBeInTheDocument();
    });
  });

  describe('Rejecting Incomparable / Qualitative Series', () => {
    it('rejects purely qualitative series from numeric plotting and renders qualitative timeline', () => {
      const qualitativeData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Urine Protein',
          value: 'Negative',
          category: 'Urinalysis',
          date: '2023-01-01T00:00:00Z',
          isAbnormal: false,
        },
        {
          id: '2',
          testName: 'Urine Protein',
          value: 'Trace',
          category: 'Urinalysis',
          date: '2023-06-01T00:00:00Z',
          isAbnormal: false,
        },
        {
          id: '3',
          testName: 'Urine Protein',
          value: '2+',
          category: 'Urinalysis',
          date: '2024-01-01T00:00:00Z',
          isAbnormal: true,
        },
      ];

      render(<TrendsChart data={qualitativeData} />);
      // Should show qualitative notice and table instead of a broken 0-line numeric chart
      expect(screen.getByText(/Qualitative Test Series/i)).toBeInTheDocument();
      expect(screen.getByText(/Cannot plot a numerical trendline/i)).toBeInTheDocument();
      expect(screen.getByText('Negative')).toBeInTheDocument();
      expect(screen.getByText('Trace')).toBeInTheDocument();
      expect(screen.getByText('2+')).toBeInTheDocument();
    });

    it('handles mixed series by plotting numeric points and notifying of excluded qualitative points', () => {
      const mixedData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Platelet Count',
          value: 250,
          category: 'Blood Work',
          date: '2024-01-01T00:00:00Z',
          referenceRange: { min: 200, max: 500, unit: 'K/uL' },
          isAbnormal: false,
        },
        {
          id: '2',
          testName: 'Platelet Count',
          value: 'Clumped / Incalculable',
          category: 'Blood Work',
          date: '2024-02-01T00:00:00Z',
          isAbnormal: true,
        },
        {
          id: '3',
          testName: 'Platelet Count',
          value: 290,
          category: 'Blood Work',
          date: '2024-03-01T00:00:00Z',
          referenceRange: { min: 200, max: 500, unit: 'K/uL' },
          isAbnormal: false,
        },
      ];

      render(<TrendsChart data={mixedData} />);
      // Should render the numeric chart and warn about excluded qualitative entries
      expect(screen.getByText(/1 qualitative\/non-numeric entry excluded from trendline/i)).toBeInTheDocument();
      expect(screen.getByText(/Clumped \/ Incalculable/i)).toBeInTheDocument();
    });
  });

  describe('Unit Separation and Normalization', () => {
    it('separates incompatible units into selectable tabs so points are not mixed on a single axis', () => {
      const multiUnitData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Red Blood Cell Count',
          value: 5.1,
          category: 'Blood Work',
          date: '2023-10-15T10:00:00Z',
          referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
          isAbnormal: true,
        },
        {
          id: '2',
          testName: 'Red Blood Cell Count',
          value: 5900,
          category: 'Blood Work',
          date: '2024-04-10T10:00:00Z',
          referenceRange: { min: 5500, max: 8500, unit: 'K/uL' },
          isAbnormal: false,
        },
        {
          id: '3',
          testName: 'Red Blood Cell Count',
          value: 4.8,
          category: 'Blood Work',
          date: '2024-10-15T10:00:00Z',
          referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
          isAbnormal: true,
        },
      ];

      render(<TrendsChart data={multiUnitData} />);

      // Should show unit selector tabs
      const muLTab = screen.getByRole('tab', { name: /M\/uL/i });
      const kuLTab = screen.getByRole('tab', { name: /K\/uL/i });

      expect(muLTab).toBeInTheDocument();
      expect(kuLTab).toBeInTheDocument();

      // Default active tab should be M/uL (most recent unit)
      expect(screen.getByText(/Displaying data for unit:/i)).toHaveTextContent(/M\/uL/);

      // Switching unit tab
      fireEvent.click(kuLTab);
      expect(screen.getByText(/Displaying data for unit:/i)).toHaveTextContent(/K\/uL/);
    });
  });

  describe('Reference-Range Provenance and Labeling', () => {
    it('labels varying reference ranges across different dates and labs', () => {
      const varyingRangeData: LabResultItem[] = [
        {
          id: '1',
          testName: 'Glucose',
          value: 95,
          category: 'Blood Work',
          date: '2023-05-10T10:00:00Z',
          referenceRange: { min: 70, max: 110, unit: 'mg/dL', sourceLab: 'IDEXX Reference Labs' },
          isAbnormal: false,
        },
        {
          id: '2',
          testName: 'Glucose',
          value: 125,
          category: 'Blood Work',
          date: '2024-05-10T10:00:00Z',
          referenceRange: { min: 74, max: 120, unit: 'mg/dL', sourceLab: 'Antech Diagnostics' },
          isAbnormal: true,
        },
      ];

      render(<TrendsChart data={varyingRangeData} />);

      // Should indicate varying reference ranges
      expect(screen.getByText(/Reference ranges vary across dates/i)).toBeInTheDocument();
      expect(screen.getAllByText(/IDEXX Reference Labs/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Antech Diagnostics/i).length).toBeGreaterThanOrEqual(1);
    });

    it('allows interactive point selection via keyboard and updates provenance card', () => {
      const data: LabResultItem[] = [
        {
          id: '1',
          testName: 'Hemoglobin',
          value: 11.5,
          category: 'Blood Work',
          date: '2024-01-01T00:00:00Z',
          referenceRange: { min: 12.0, max: 18.0, unit: 'g/dL' },
          isAbnormal: true,
        },
        {
          id: '2',
          testName: 'Hemoglobin',
          value: 13.8,
          category: 'Blood Work',
          date: '2024-06-01T00:00:00Z',
          referenceRange: { min: 12.0, max: 18.0, unit: 'g/dL' },
          isAbnormal: false,
        },
      ];

      render(<TrendsChart data={data} />);

      const pointButtons = screen.getAllByRole('button', { name: /View result for/i });
      expect(pointButtons.length).toBe(2);

      // Select first point
      fireEvent.click(pointButtons[0]);
      expect(screen.getByText(/11.5 g\/dL/i)).toBeInTheDocument();
      expect(screen.getByText(/Below normal/i)).toBeInTheDocument();

      // Select second point
      fireEvent.click(pointButtons[1]);
      expect(screen.getByText(/13.8 g\/dL/i)).toBeInTheDocument();
      expect(screen.getByText(/Within normal range/i)).toBeInTheDocument();
    });

    it('sets accessible aria-label with testName prop', () => {
      const data: LabResultItem[] = [
        {
          id: '1',
          testName: 'Hemoglobin',
          value: 14.0,
          category: 'Blood Work',
          date: '2024-01-01T00:00:00Z',
        },
      ];

      render(<TrendsChart data={data} testName="Hemoglobin" />);
      expect(screen.getByRole('region', { name: /Lab result trend chart for Hemoglobin/i })).toBeInTheDocument();
    });

    it('handles inverted reference ranges (min > max) without crashing', () => {
      const data: LabResultItem[] = [
        {
          id: '1',
          testName: 'Special Assay',
          value: 50,
          category: 'Other',
          date: '2024-01-01T00:00:00Z',
          referenceRange: { min: 100, max: 20, unit: 'U/L' },
          isAbnormal: true,
        },
      ];

      render(<TrendsChart data={data} />);
      expect(screen.getByText(/50 U\/L/i)).toBeInTheDocument();
      expect(screen.getByText(/100 – 20 U\/L/i)).toBeInTheDocument();
    });
  });
});
