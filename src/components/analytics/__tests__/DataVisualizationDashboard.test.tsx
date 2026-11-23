import React from 'react';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import DataVisualizationDashboard, {
  type DashboardData,
} from '../DataVisualizationDashboard';

jest.mock('recharts', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const passthrough = ({ children }: { children?: ReactNode }) =>
    ReactModule.createElement('div', null, children);
  const Pie = ({
    data,
    label,
    children,
  }: {
    data: Array<{ region?: string }>;
    label?: (props: { name?: string; percent?: number }) => ReactNode;
    children?: ReactNode;
  }) =>
    ReactModule.createElement(
      'div',
      null,
      data.map((entry, index) =>
        ReactModule.createElement(
          'span',
          { key: index },
          label?.({ name: entry.region, percent: index === 0 ? undefined : 0.5 }),
        ),
      ),
      children,
    );

  return {
    LineChart: passthrough,
    Line: passthrough,
    BarChart: passthrough,
    Bar: passthrough,
    AreaChart: passthrough,
    Area: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
    CartesianGrid: passthrough,
    Tooltip: passthrough,
    Legend: passthrough,
    ResponsiveContainer: passthrough,
    PieChart: passthrough,
    Pie,
    Cell: passthrough,
    ComposedChart: passthrough,
    RadialBarChart: passthrough,
    RadialBar: passthrough,
  };
});

const dashboardData = (vetLocations: DashboardData['vetLocations']): DashboardData => ({
  weightHistory: [],
  vaccinations: [],
  healthMetrics: [],
  vetLocations,
  summary: {
    totalPets: 0,
    upcomingVaccinations: 0,
    averageWeight: 0,
    abnormalResults: 0,
  },
});

describe('DataVisualizationDashboard geographic chart', () => {
  it('renders a pie label from its name when the optional percent is missing', () => {
    render(
      <DataVisualizationDashboard
        data={dashboardData([
          { name: 'Example Clinic', city: 'Test City', region: 'North', pets: 2, rating: 4 },
          { name: 'Sample Clinic', city: 'Test City', region: 'South', pets: 1, rating: 4 },
        ])}
      />,
    );

    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('South 50%')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
  });

  it('shows an empty state when no geographic chart data is available', () => {
    render(<DataVisualizationDashboard data={dashboardData([])} />);

    expect(screen.getByText('No geographic data available.')).toBeInTheDocument();
  });
});
