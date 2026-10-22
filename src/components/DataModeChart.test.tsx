import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import DataModeChart from './DataModeChart';
import { DataModeProvider } from '@/contexts/DataModeContext';
import React from 'react';

const renderWithDataMode = (ui: React.ReactElement, mode: 'full' | 'reduced' = 'full') => {
  if (mode === 'reduced') {
    localStorage.setItem('petchain-data-mode', 'reduced');
  }

  return render(<DataModeProvider>{ui}</DataModeProvider>);
};

const TestChart = () => <div data-testid="test-chart">Chart Content</div>;

describe('DataModeChart Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Full Mode Behavior', () => {
    it('should render children in full mode', () => {
      renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'full'
      );

      expect(screen.getByTestId('test-chart')).toBeInTheDocument();
    });

    it('should not show placeholder in full mode', () => {
      renderWithDataMode(
        <DataModeChart title="Test Chart" summary="Chart summary">
          <TestChart />
        </DataModeChart>,
        'full'
      );

      expect(screen.queryByRole('button', { name: /view.*chart/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/reduced data mode/i)).not.toBeInTheDocument();
    });
  });

  describe('Reduced Mode - Non-Priority Charts', () => {
    it('should show placeholder in reduced mode for non-priority charts', () => {
      renderWithDataMode(
        <DataModeChart title="Analytics Chart" summary="View engagement metrics">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(screen.queryByTestId('test-chart')).not.toBeInTheDocument();
      expect(screen.getByText('Analytics Chart')).toBeInTheDocument();
      expect(screen.getByText('View engagement metrics')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view.*chart/i })).toBeInTheDocument();
    });

    it('should render chart when user clicks View button', async () => {
      renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const viewButton = screen.getByRole('button', { name: /view.*chart/i });
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      });
    });

    it('should render chart on Enter key press', async () => {
      renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const viewButton = screen.getByRole('button', { name: /view.*chart/i });
      fireEvent.keyDown(viewButton, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      });
    });

    it('should render chart on Space key press', async () => {
      renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const viewButton = screen.getByRole('button', { name: /view.*chart/i });
      fireEvent.keyDown(viewButton, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      });
    });

    it('should display summary text when provided', () => {
      renderWithDataMode(
        <DataModeChart title="Health Chart" summary="Monitor vaccination status">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(screen.getByText('Monitor vaccination status')).toBeInTheDocument();
    });

    it('should not display summary when not provided', () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      // Should not have a summary paragraph
      const summaries = container.querySelectorAll('p');
      const hasSummary = Array.from(summaries).some(
        (p) => !p.textContent?.includes('Reduced data mode')
      );
      expect(hasSummary).toBe(false);
    });
  });

  describe('Reduced Mode - Priority Charts', () => {
    it('should always render priority charts', () => {
      renderWithDataMode(
        <DataModeChart title="Emergency Alerts" priority={true}>
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('should apply custom minHeight', () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart" minHeight="500px">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const placeholder = container.querySelector('[role="region"]');
      expect(placeholder).toHaveStyle({ minHeight: '500px' });
    });

    it('should apply default minHeight when not specified', () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const placeholder = container.querySelector('[role="region"]');
      expect(placeholder).toHaveStyle({ minHeight: '300px' });
    });

    it('should support numeric minHeight', () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart" minHeight={400}>
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const placeholder = container.querySelector('[role="region"]');
      expect(placeholder).toHaveStyle({ minHeight: 400 });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations in full mode', async () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'full'
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in reduced mode', async () => {
      const { container } = renderWithDataMode(
        <DataModeChart title="Test Chart" summary="Chart summary">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide descriptive aria-label for placeholder region', () => {
      renderWithDataMode(
        <DataModeChart title="Vaccination Compliance">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(
        screen.getByLabelText(/vaccination compliance.*deferred.*bandwidth/i)
      ).toBeInTheDocument();
    });

    it('should provide descriptive aria-label for view button', () => {
      renderWithDataMode(
        <DataModeChart title="Pet Health Overview">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(
        screen.getByRole('button', { name: /view pet health overview chart/i })
      ).toBeInTheDocument();
    });

    it('should use semantic heading for chart title', () => {
      renderWithDataMode(
        <DataModeChart title="User Analytics">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(screen.getByRole('heading', { name: 'User Analytics' })).toBeInTheDocument();
    });
  });

  describe('User Interaction Flow', () => {
    it('should maintain chart state after user opts in', async () => {
      const { rerender } = renderWithDataMode(
        <DataModeChart title="Test Chart">
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      // User clicks to view chart
      const viewButton = screen.getByRole('button', { name: /view.*chart/i });
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      });

      // Re-render with same props
      rerender(
        <DataModeProvider>
          <DataModeChart title="Test Chart">
            <TestChart />
          </DataModeChart>
        </DataModeProvider>
      );

      // Chart should still be visible (user's choice persists)
      expect(screen.getByTestId('test-chart')).toBeInTheDocument();
    });
  });

  describe('Emergency and Critical Care', () => {
    it('should render emergency charts immediately in reduced mode', () => {
      renderWithDataMode(
        <DataModeChart title="Critical Alerts" priority={true}>
          <TestChart />
        </DataModeChart>,
        'reduced'
      );

      expect(screen.getByTestId('test-chart')).toBeInTheDocument();
    });

    it('should render critical health indicators immediately', () => {
      renderWithDataMode(
        <DataModeChart title="Vital Signs Monitor" priority={true}>
          <div data-testid="vital-signs">Heart Rate: 72 BPM</div>
        </DataModeChart>,
        'reduced'
      );

      expect(screen.getByTestId('vital-signs')).toBeInTheDocument();
    });
  });
});
