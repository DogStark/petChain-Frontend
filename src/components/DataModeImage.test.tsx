import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import DataModeImage from './DataModeImage';
import { DataModeProvider } from '@/contexts/DataModeContext';
import React from 'react';

// Mock SafeImage
jest.mock('./SafeImage', () => ({
  __esModule: true,
  default: (props: any) => <img data-testid="safe-image" {...props} />,
}));

const renderWithDataMode = (ui: React.ReactElement, mode: 'full' | 'reduced' = 'full') => {
  if (mode === 'reduced') {
    localStorage.setItem('petchain-data-mode', 'reduced');
  }

  return render(<DataModeProvider>{ui}</DataModeProvider>);
};

describe('DataModeImage Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Full Mode Behavior', () => {
    it('should render SafeImage in full mode', () => {
      renderWithDataMode(
        <DataModeImage src="/test-image.jpg" alt="Test image" width={200} height={200} />,
        'full'
      );

      expect(screen.getByTestId('safe-image')).toBeInTheDocument();
    });

    it('should pass all props to SafeImage', () => {
      renderWithDataMode(
        <DataModeImage
          src="/test.jpg"
          alt="Test"
          width={300}
          height={200}
          priority={false}
        />,
        'full'
      );

      const img = screen.getByTestId('safe-image');
      expect(img).toHaveAttribute('alt', 'Test');
      expect(img).toHaveAttribute('width', '300');
      expect(img).toHaveAttribute('height', '200');
    });
  });

  describe('Reduced Mode - Non-Priority Images', () => {
    it('should show placeholder in reduced mode for non-priority images', () => {
      renderWithDataMode(
        <DataModeImage
          src="/large-image.jpg"
          alt="Large image"
          width={800}
          height={600}
          priority={false}
        />,
        'reduced'
      );

      expect(screen.queryByTestId('safe-image')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /load image/i })).toBeInTheDocument();
      expect(screen.getByText(/reduced data mode/i)).toBeInTheDocument();
    });

    it('should load image when user clicks Load button', async () => {
      renderWithDataMode(
        <DataModeImage
          src="/test-image.jpg"
          alt="Test image"
          width={400}
          height={300}
          priority={false}
        />,
        'reduced'
      );

      const loadButton = screen.getByRole('button', { name: /load image/i });
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(screen.getByTestId('safe-image')).toBeInTheDocument();
      });
    });

    it('should load image on Enter key press', async () => {
      renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test" width={200} height={200} />,
        'reduced'
      );

      const loadButton = screen.getByRole('button', { name: /load image/i });
      fireEvent.keyDown(loadButton, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('safe-image')).toBeInTheDocument();
      });
    });

    it('should load image on Space key press', async () => {
      renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test" width={200} height={200} />,
        'reduced'
      );

      const loadButton = screen.getByRole('button', { name: /load image/i });
      fireEvent.keyDown(loadButton, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByTestId('safe-image')).toBeInTheDocument();
      });
    });
  });

  describe('Reduced Mode - Priority Images', () => {
    it('should always load priority images', () => {
      renderWithDataMode(
        <DataModeImage
          src="/emergency-contact.jpg"
          alt="Emergency contact"
          width={200}
          height={200}
          priority={true}
        />,
        'reduced'
      );

      expect(screen.getByTestId('safe-image')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /load image/i })).not.toBeInTheDocument();
    });
  });

  describe('Reduced Mode - Thumbnails', () => {
    it('should always load thumbnail-sized images', () => {
      renderWithDataMode(
        <DataModeImage
          src="/thumb.jpg"
          alt="Thumbnail"
          width={100}
          height={100}
          sizeCategory="thumbnail"
        />,
        'reduced'
      );

      expect(screen.getByTestId('safe-image')).toBeInTheDocument();
    });
  });

  describe('Placeholder Styling', () => {
    it('should apply fill classes when fill prop is true', () => {
      const { container } = renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test" fill />,
        'reduced'
      );

      const placeholder = container.querySelector('[role="img"]');
      expect(placeholder).toHaveClass('absolute', 'inset-0');
    });

    it('should apply width/height styles when dimensions provided', () => {
      const { container } = renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test" width={300} height={200} />,
        'reduced'
      );

      const placeholder = container.querySelector('[role="img"]');
      expect(placeholder).toHaveStyle({ width: 300, height: 200 });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations in full mode', async () => {
      const { container } = renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test image" width={200} height={200} />,
        'full'
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in reduced mode', async () => {
      const { container } = renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Test image" width={200} height={200} />,
        'reduced'
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide descriptive aria-label for placeholder', () => {
      renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Profile picture" width={200} height={200} />,
        'reduced'
      );

      expect(
        screen.getByLabelText(/profile picture.*deferred.*bandwidth/i)
      ).toBeInTheDocument();
    });

    it('should provide descriptive aria-label for load button', () => {
      renderWithDataMode(
        <DataModeImage src="/test.jpg" alt="Pet photo" width={200} height={200} />,
        'reduced'
      );

      expect(screen.getByRole('button', { name: /load image.*pet photo/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null src', () => {
      renderWithDataMode(
        <DataModeImage src={null} alt="Missing image" width={200} height={200} />,
        'reduced'
      );

      // Should show placeholder even in reduced mode
      expect(screen.getByRole('button', { name: /load image/i })).toBeInTheDocument();
    });

    it('should handle undefined src', () => {
      renderWithDataMode(
        <DataModeImage src={undefined} alt="No image" width={200} height={200} />,
        'reduced'
      );

      expect(screen.getByRole('button', { name: /load image/i })).toBeInTheDocument();
    });

    it('should handle empty string src', () => {
      renderWithDataMode(
        <DataModeImage src="" alt="Empty" width={200} height={200} />,
        'reduced'
      );

      expect(screen.getByRole('button', { name: /load image/i })).toBeInTheDocument();
    });
  });
});
