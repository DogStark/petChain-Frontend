import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import type { LabResultItem } from '@/types/lab-results';
import ResultList from '../ResultList';

const makeResult = (overrides: Partial<LabResultItem> = {}): LabResultItem => ({
  id: 'result-1',
  testName: 'Red Blood Cell Count',
  value: 6.2,
  category: 'Blood Work',
  date: '2026-10-19T12:00:00.000Z',
  referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
  isAbnormal: false,
  ...overrides,
});

describe('ResultList explanations', () => {
  it('keeps clinician-authored test wording and provides concise context beside it', () => {
    render(
      <ResultList
        results={[makeResult({ testName: 'RBC' })]}
        onSelectTest={jest.fn()}
        selectedTest={null}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'RBC' });
    expect(heading).toHaveTextContent('RBC');
    expect(heading).toHaveAccessibleDescription(
      'Measures red blood cells, which carry oxygen around the body.',
    );
    expect(screen.getByText('Tests measured in a blood sample.')).toBeInTheDocument();
  });

  it('exposes reference range and abnormal-flag explanations after keyboard expansion', () => {
    const onSelectTest = jest.fn();
    render(
      <ResultList
        results={[makeResult({ testName: 'Glucose', isAbnormal: true })]}
        onSelectTest={onSelectTest}
        selectedTest={null}
      />,
    );

    const resultCard = screen.getByRole('button', { name: /Glucose/ });
    fireEvent.keyDown(resultCard, { key: 'Enter' });

    expect(onSelectTest).toHaveBeenCalledWith('Glucose');
    expect(within(resultCard).getByText(/The interval provided by the reporting lab/)).toBeInTheDocument();
    expect(within(resultCard).getByText(/this result alone is not a diagnosis/i)).toBeInTheDocument();
  });

  it('shows the empty state and does not invent an explanation for unknown terms or missing ranges', () => {
    const { rerender } = render(
      <ResultList results={[]} onSelectTest={jest.fn()} selectedTest={null} />,
    );
    expect(screen.getByText('No results found')).toBeInTheDocument();

    rerender(
      <ResultList
        results={[
          makeResult({
            testName: 'Clinician-specific assay (Lab X)',
            category: 'Other',
            referenceRange: undefined,
          }),
        ]}
        onSelectTest={jest.fn()}
        selectedTest={null}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Clinician-specific assay (Lab X)' })).toBeInTheDocument();
    expect(screen.queryByText(/Measures red blood cells/)).not.toBeInTheDocument();
    const resultCard = screen.getByRole('button', { name: /Clinician-specific assay/ });
    fireEvent.keyDown(resultCard, { key: ' ' });
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(within(resultCard).getByText(/does not replace veterinary interpretation/i)).toBeInTheDocument();
  });
});
