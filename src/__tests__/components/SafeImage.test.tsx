import React from 'react';
import { render, waitFor } from '@testing-library/react';
import SafeImage from '@/components/SafeImage';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { onError, ...rest } = props;
    return (
      <img
        {...rest}
        onError={(e) => {
          if (onError) onError(e);
        }}
      />
    );
  },
}));

// Mock the remote image hosts check
jest.mock('@/lib/images/remoteImageHosts', () => ({
  isAllowedImageSrc: (src: string) => {
    // Simulate allowlist - only allow certain domains
    return (
      src?.startsWith('https://allowed.com') ||
      src?.startsWith('https://cdn.allowed.com')
    );
  },
}));

describe('SafeImage Component', () => {
  const DEFAULT_FALLBACK = '/file.svg';

  describe('Valid Image Loading', () => {
    it('renders image when src is valid and allowed', () => {
      const { container } = render(
        <SafeImage
          src="https://allowed.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toContain('allowed.com/photo.jpg');
      expect(img?.getAttribute('alt')).toBe('Test photo');
    });

    it('preserves all next/image props', () => {
      const { container } = render(
        <SafeImage
          src="https://allowed.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
          priority
          data-testid="test-image"
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('data-testid')).toBe('test-image');
    });
  });

  describe('Fallback Behavior', () => {
    it('uses default fallback when src is null', () => {
      const { container } = render(
        <SafeImage
          src={null}
          alt="Fallback image"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });

    it('uses default fallback when src is undefined', () => {
      const { container } = render(
        <SafeImage
          src={undefined}
          alt="Fallback image"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });

    it('uses default fallback when src is empty string', () => {
      const { container } = render(
        <SafeImage
          src=""
          alt="Fallback image"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });

    it('uses custom fallback when provided', () => {
      const customFallback = '/custom-placeholder.png';
      const { container } = render(
        <SafeImage
          src={null}
          alt="Fallback image"
          fallbackSrc={customFallback}
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(customFallback);
    });
  });

  describe('Remote Host Validation', () => {
    it('uses fallback for disallowed remote host', () => {
      const { container } = render(
        <SafeImage
          src="https://untrusted.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });

    it('allows image from allowed host', () => {
      const { container } = render(
        <SafeImage
          src="https://allowed.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain('allowed.com/photo.jpg');
    });
  });

  describe('Error Handling', () => {
    it('switches to fallback when image fails to load', async () => {
      const { container } = render(
        <SafeImage
          src="https://allowed.com/broken.jpg"
          alt="Test photo"
          width={200}
          height={200}
          data-testid="safe-img"
        />
      );

      const img = container.querySelector('img[data-testid="safe-img"]');
      expect(img?.getAttribute('src')).toContain('broken.jpg');

      // Simulate image load error
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        const updatedImg = container.querySelector('img[data-testid="safe-img"]');
        expect(updatedImg?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
      });
    });

    it('calls onFallback callback when fallback is used', async () => {
      const onFallback = jest.fn();
      const { container } = render(
        <SafeImage
          src="https://allowed.com/broken.jpg"
          alt="Test photo"
          width={200}
          height={200}
          onFallback={onFallback}
        />
      );

      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        expect(onFallback).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onFallback for initially null src', () => {
      const onFallback = jest.fn();
      render(
        <SafeImage
          src={null}
          alt="Test photo"
          width={200}
          height={200}
          onFallback={onFallback}
        />
      );

      expect(onFallback).not.toHaveBeenCalled();
    });
  });

  describe('Src Changes', () => {
    it('resets error state when src changes to valid URL', async () => {
      const { container, rerender } = render(
        <SafeImage
          src="https://allowed.com/broken.jpg"
          alt="Test photo"
          width={200}
          height={200}
          data-testid="safe-img"
        />
      );

      // Trigger error on first image
      const img1 = container.querySelector('img[data-testid="safe-img"]');
      if (img1) {
        img1.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        const fallbackImg = container.querySelector('img[data-testid="safe-img"]');
        expect(fallbackImg?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
      });

      // Change src to valid image
      rerender(
        <SafeImage
          src="https://allowed.com/valid.jpg"
          alt="Test photo"
          width={200}
          height={200}
          data-testid="safe-img"
        />
      );

      await waitFor(() => {
        const validImg = container.querySelector('img[data-testid="safe-img"]');
        expect(validImg?.getAttribute('src')).toContain('valid.jpg');
      });
    });

    it('switches to fallback when src changes from valid to null', () => {
      const { container, rerender } = render(
        <SafeImage
          src="https://allowed.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      const img1 = container.querySelector('img');
      expect(img1?.getAttribute('src')).toContain('photo.jpg');

      rerender(
        <SafeImage
          src={null}
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      const img2 = container.querySelector('img');
      expect(img2?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });
  });

  describe('Alt Text Preservation', () => {
    it('preserves alt text when using fallback', () => {
      const altText = 'Important descriptive text';
      const { container } = render(
        <SafeImage
          src={null}
          alt={altText}
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('alt')).toBe(altText);
    });

    it('preserves empty alt text for decorative images', () => {
      const { container } = render(
        <SafeImage
          src={null}
          alt=""
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      expect(img?.getAttribute('alt')).toBe('');
    });

    it('maintains alt text after error fallback', async () => {
      const altText = 'Photo description';
      const { container } = render(
        <SafeImage
          src="https://allowed.com/broken.jpg"
          alt={altText}
          width={200}
          height={200}
        />
      );

      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        const fallbackImg = container.querySelector('img');
        expect(fallbackImg?.getAttribute('alt')).toBe(altText);
      });
    });
  });

  describe('No Retry Behavior', () => {
    it('immediately shows fallback for invalid src without retry', () => {
      const { container } = render(
        <SafeImage
          src="https://untrusted.com/photo.jpg"
          alt="Test photo"
          width={200}
          height={200}
        />
      );

      // Should immediately use fallback, not attempt to load
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain(DEFAULT_FALLBACK);
    });

    it('does not retry after error', async () => {
      const onFallback = jest.fn();
      const { container } = render(
        <SafeImage
          src="https://allowed.com/broken.jpg"
          alt="Test photo"
          width={200}
          height={200}
          onFallback={onFallback}
        />
      );

      const img = container.querySelector('img');
      
      // Trigger error once
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        expect(onFallback).toHaveBeenCalledTimes(1);
      });

      // Trigger error again
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      // Should not call onFallback again
      await waitFor(() => {
        expect(onFallback).toHaveBeenCalledTimes(1);
      });
    });
  });
});
