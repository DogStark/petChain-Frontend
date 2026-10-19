import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import SafeImage from '@/components/SafeImage';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & {
    onLoad?: () => void;
    onError?: () => void;
    fill?: boolean;
    sizes?: string;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    const { onLoad, onError, fill, sizes, priority, unoptimized, ...imgProps } = props;

    return (
      <img
        {...imgProps}
        onLoad={(e) => {
          onLoad?.();
          imgProps.onLoad?.(e);
        }}
        onError={(e) => {
          onError?.();
          imgProps.onError?.(e);
        }}
        data-testid="safe-image"
      />
    );
  },
}));

describe('SafeImage Component', () => {
  describe('Valid Image Sources', () => {
    it('renders image with valid src', () => {
      const { getByTestId } = render(
        <SafeImage src="/valid-image.jpg" alt="Test image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('valid-image.jpg'));
      expect(img).toHaveAttribute('alt', 'Test image');
    });

    it('renders image with relative path', () => {
      const { getByTestId } = render(
        <SafeImage src="/images/photo.png" alt="Photo" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('src', expect.stringContaining('photo.png'));
    });
  });

  describe('Broken Images', () => {
    it('falls back to default placeholder on error', async () => {
      const { container, getByTestId } = render(
        <SafeImage src="/broken-image.jpg" alt="Broken image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');

      // Simulate image load error
      img.dispatchEvent(new Event('error'));

      await waitFor(() => {
        const updatedImg = getByTestId('safe-image');
        expect(updatedImg).toHaveAttribute('src', expect.stringContaining('file.svg'));
      });
    });

    it('uses custom fallback when provided', async () => {
      const { getByTestId } = render(
        <SafeImage
          src="/broken-image.jpg"
          alt="Broken image"
          fallbackSrc="/custom-fallback.png"
          width={100}
          height={100}
        />
      );

      const img = getByTestId('safe-image');
      img.dispatchEvent(new Event('error'));

      await waitFor(() => {
        const updatedImg = getByTestId('safe-image');
        expect(updatedImg).toHaveAttribute('src', expect.stringContaining('custom-fallback.png'));
      });
    });
  });

  describe('Missing Images', () => {
    it('uses fallback when src is null', () => {
      const { getByTestId } = render(
        <SafeImage src={null} alt="Missing image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('src', expect.stringContaining('file.svg'));
    });

    it('uses fallback when src is undefined', () => {
      const { getByTestId } = render(
        <SafeImage src={undefined} alt="Missing image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('src', expect.stringContaining('file.svg'));
    });

    it('uses fallback when src is empty string', () => {
      const { getByTestId } = render(
        <SafeImage src="" alt="Empty image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('src', expect.stringContaining('file.svg'));
    });
  });

  describe('Loading States', () => {
    it('handles image load event', async () => {
      const { getByTestId } = render(
        <SafeImage src="/loading-image.jpg" alt="Loading image" width={100} height={100} />
      );

      const img = getByTestId('safe-image');

      // Simulate successful image load
      img.dispatchEvent(new Event('load'));

      await waitFor(() => {
        expect(img).toBeInTheDocument();
      });
    });

    it('applies transition styles after loading', async () => {
      const { getByTestId } = render(
        <SafeImage
          src="/transition-image.jpg"
          alt="Transition test"
          width={100}
          height={100}
          style={{ border: '1px solid red' }}
        />
      );

      const img = getByTestId('safe-image');

      // Before load - no transition
      expect(img).toHaveStyle({ transition: 'none' });

      // Simulate image load
      img.dispatchEvent(new Event('load'));

      await waitFor(() => {
        expect(img).toHaveStyle({ transition: 'opacity 0.2s ease-in-out' });
      });
    });
  });

  describe('Layout Shift Prevention', () => {
    it('maintains stable dimensions with fill prop', () => {
      const { getByTestId } = render(
        <div style={{ position: 'relative', width: '200px', height: '200px' }}>
          <SafeImage src="/fill-image.jpg" alt="Fill image" fill />
        </div>
      );

      const img = getByTestId('safe-image');
      expect(img).toBeInTheDocument();
    });

    it('maintains stable dimensions with width/height props', () => {
      const { getByTestId } = render(
        <SafeImage src="/sized-image.jpg" alt="Sized image" width={150} height={150} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('width', '150');
      expect(img).toHaveAttribute('height', '150');
    });

    it('preserves custom styles during loading', () => {
      const customStyle = { border: '2px solid blue', borderRadius: '8px' };
      const { getByTestId } = render(
        <SafeImage
          src="/styled-image.jpg"
          alt="Styled image"
          width={100}
          height={100}
          style={customStyle}
        />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveStyle({ border: '2px solid blue', borderRadius: '8px' });
    });
  });

  describe('Changed Avatar States', () => {
    it('updates image when src changes from valid to broken', async () => {
      const { getByTestId, rerender } = render(
        <SafeImage src="/valid-image.jpg" alt="Image" width={100} height={100} />
      );

      rerender(<SafeImage src="/broken-image.jpg" alt="Image" width={100} height={100} />);

      const img = getByTestId('safe-image');
      img.dispatchEvent(new Event('error'));

      await waitFor(() => {
        const updatedImg = getByTestId('safe-image');
        expect(updatedImg).toHaveAttribute('src', expect.stringContaining('file.svg'));
      });
    });

    it('updates from fallback to valid image when src is added', () => {
      const { getByTestId, rerender } = render(
        <SafeImage src={null} alt="Image" width={100} height={100} />
      );

      expect(getByTestId('safe-image')).toHaveAttribute('src', expect.stringContaining('file.svg'));

      rerender(<SafeImage src="/new-image.jpg" alt="Image" width={100} height={100} />);

      expect(getByTestId('safe-image')).toHaveAttribute('src', expect.stringContaining('new-image.jpg'));
    });
  });

  describe('Accessibility', () => {
    it('passes axe accessibility tests with valid image', async () => {
      const { container } = render(
        <SafeImage src="/accessible-image.jpg" alt="Accessible image description" width={100} height={100} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests with fallback image', async () => {
      const { container } = render(
        <SafeImage src={null} alt="Fallback image description" width={100} height={100} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains alt text on error', async () => {
      const { getByTestId } = render(
        <SafeImage src="/error-image.jpg" alt="Important description" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      img.dispatchEvent(new Event('error'));

      await waitFor(() => {
        const updatedImg = getByTestId('safe-image');
        expect(updatedImg).toHaveAttribute('alt', 'Important description');
      });
    });

    it('supports empty alt text for decorative images', () => {
      const { getByTestId } = render(
        <SafeImage src="/decorative.jpg" alt="" width={100} height={100} />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveAttribute('alt', '');
    });
  });

  describe('Custom Props', () => {
    it('passes through additional Image props', () => {
      const { getByTestId } = render(
        <SafeImage
          src="/custom-props-image.jpg"
          alt="Custom props"
          width={100}
          height={100}
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      );

      const img = getByTestId('safe-image');
      expect(img).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { getByTestId } = render(
        <SafeImage
          src="/classed-image.jpg"
          alt="Classed image"
          width={100}
          height={100}
          className="custom-image-class"
        />
      );

      const img = getByTestId('safe-image');
      expect(img).toHaveClass('custom-image-class');
    });
  });
});
