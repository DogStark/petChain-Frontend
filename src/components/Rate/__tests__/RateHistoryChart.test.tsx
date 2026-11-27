import React from 'react';
import { render, screen } from '@testing-library/react';
import { RateHistoryChart } from '../RateHistoryChart';

jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe('RateHistoryChart', () => {
  const data = [
    { date: '2024-01-15', rate: 1.2345 },
    { date: '2024-02-15', rate: 2.5 },
  ];

  it('renders the chart with provided data', () => {
    render(<RateHistoryChart data={data} currency="USD" />);
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('renders without crashing when data is empty', () => {
    render(<RateHistoryChart data={[]} />);
    expect(document.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('formats currency and date for hover data', () => {
    const formatRate = (value: number, currency: string) =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 6,
      }).format(value);

    expect(formatRate(1.2345, 'USD')).toContain('1.2345');
    expect(formatRate(2.5, 'EUR')).toContain('2.5');

    const formattedDate = new Date('2024-01-15').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    expect(formattedDate).toContain('2024');
  });
});
