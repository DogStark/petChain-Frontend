import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import DataModeSettings from './DataModeSettings';
import { DataModeProvider } from '@/contexts/DataModeContext';
import React from 'react';

const renderWithProvider = (mode: 'full' | 'reduced' = 'full') => {
  if (mode === 'reduced') {
    localStorage.setItem('petchain-data-mode', 'reduced');
  }

  return render(
    <DataModeProvider>
      <DataModeSettings />
    </DataModeProvider>
  );
};

describe('DataModeSettings Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render the settings panel', () => {
      renderWithProvider();

      expect(screen.getByText('Data Mode')).toBeInTheDocument();
      expect(screen.getByText(/control how images and charts are loaded/i)).toBeInTheDocument();
    });

    it('should render both mode options', () => {
      renderWithProvider();

      expect(screen.getByLabelText(/full mode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reduced data mode/i)).toBeInTheDocument();
    });

    it('should render privacy notice', () => {
      renderWithProvider();

      expect(screen.getByText(/privacy notice/i)).toBeInTheDocument();
      expect(screen.getByText(/stored locally.*never shared/i)).toBeInTheDocument();
    });

    it('should show appropriate icon for current mode', () => {
      const { rerender } = renderWithProvider('full');
      
      // Check for Wifi icon in full mode
      let container = screen.getByText('Data Mode').parentElement;
      expect(container).toBeInTheDocument();

      // Switch to reduced mode and check for WifiOff icon
      localStorage.setItem('petchain-data-mode', 'reduced');
      rerender(
        <DataModeProvider>
          <DataModeSettings />
        </DataModeProvider>
      );
    });
  });

  describe('Mode Selection', () => {
    it('should have full mode selected by default', () => {
      renderWithProvider();

      const fullModeRadio = screen.getByRole('radio', { name: /full mode/i });
      expect(fullModeRadio).toBeChecked();
    });

    it('should have reduced mode selected when stored in localStorage', () => {
      renderWithProvider('reduced');

      const reducedModeRadio = screen.getByRole('radio', { name: /reduced data mode/i });
      expect(reducedModeRadio).toBeChecked();
    });

    it('should switch to reduced mode when clicked', () => {
      renderWithProvider('full');

      const reducedModeLabel = screen.getByText(/reduced data mode/i).closest('label');
      if (reducedModeLabel) fireEvent.click(reducedModeLabel);

      const reducedModeRadio = screen.getByRole('radio', { name: /reduced data mode/i });
      expect(reducedModeRadio).toBeChecked();
      expect(localStorage.getItem('petchain-data-mode')).toBe('reduced');
    });

    it('should switch to full mode when clicked', () => {
      renderWithProvider('reduced');

      const fullModeLabel = screen.getByText(/full mode/i).closest('label');
      if (fullModeLabel) fireEvent.click(fullModeLabel);

      const fullModeRadio = screen.getByRole('radio', { name: /full mode/i });
      expect(fullModeRadio).toBeChecked();
      expect(localStorage.getItem('petchain-data-mode')).toBe('full');
    });
  });

  describe('Mode Descriptions', () => {
    it('should show full mode description', () => {
      renderWithProvider();

      expect(
        screen.getByText(/load all images and charts automatically/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/best for stable connections/i)).toBeInTheDocument();
    });

    it('should show reduced mode description', () => {
      renderWithProvider();

      expect(screen.getByText(/defer large images and charts/i)).toBeInTheDocument();
      expect(
        screen.getByText(/emergency and critical care actions remain immediately available/i)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProvider();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should use proper radio button group semantics', () => {
      renderWithProvider();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);

      radios.forEach((radio) => {
        expect(radio).toHaveAttribute('name', 'data-mode');
      });
    });

    it('should associate descriptions with radio buttons', () => {
      renderWithProvider();

      const fullModeRadio = screen.getByRole('radio', { name: /full mode/i });
      const reducedModeRadio = screen.getByRole('radio', { name: /reduced data mode/i });

      expect(fullModeRadio).toHaveAttribute('aria-describedby', 'full-mode-description');
      expect(reducedModeRadio).toHaveAttribute('aria-describedby', 'reduced-mode-description');
    });

    it('should be keyboard navigable', () => {
      renderWithProvider();

      const fullModeRadio = screen.getByRole('radio', { name: /full mode/i });
      const reducedModeRadio = screen.getByRole('radio', { name: /reduced data mode/i });

      // Should be able to focus
      fullModeRadio.focus();
      expect(document.activeElement).toBe(fullModeRadio);

      reducedModeRadio.focus();
      expect(document.activeElement).toBe(reducedModeRadio);
    });

    it('should provide focus indicators', () => {
      const { container } = renderWithProvider();

      const radios = container.querySelectorAll('input[type="radio"]');
      radios.forEach((radio) => {
        expect(radio).toHaveClass('focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-2');
      });
    });
  });

  describe('Visual Feedback', () => {
    it('should have visual focus indicators on labels', () => {
      const { container } = renderWithProvider();

      const labels = container.querySelectorAll('label');
      labels.forEach((label) => {
        expect(label).toHaveClass('hover:bg-gray-50');
      });
    });

    it('should show privacy notice with proper styling', () => {
      const { container } = renderWithProvider();

      const privacyNotice = screen.getByText(/privacy notice/i).closest('div');
      expect(privacyNotice).toHaveClass('bg-blue-50');
    });
  });

  describe('Privacy Compliance', () => {
    it('should emphasize that preference is stored locally', () => {
      renderWithProvider();

      expect(screen.getByText(/stored locally on your device/i)).toBeInTheDocument();
      expect(screen.getByText(/never shared with our servers/i)).toBeInTheDocument();
    });

    it('should not make network requests when changing mode', () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      renderWithProvider();

      const reducedModeLabel = screen.getByText(/reduced data mode/i).closest('label');
      if (reducedModeLabel) fireEvent.click(reducedModeLabel);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('User Experience', () => {
    it('should provide clear labels and descriptions', () => {
      renderWithProvider();

      // Full mode
      expect(screen.getByText('Full Mode')).toBeInTheDocument();
      expect(
        screen.getByText(/load all images and charts automatically/i)
      ).toBeInTheDocument();

      // Reduced mode
      expect(screen.getByText('Reduced Data Mode')).toBeInTheDocument();
      expect(screen.getByText(/defer large images and charts/i)).toBeInTheDocument();
    });

    it('should highlight the importance of emergency actions', () => {
      renderWithProvider();

      expect(
        screen.getByText(/emergency and critical care actions remain immediately available/i)
      ).toBeInTheDocument();
    });
  });
});
