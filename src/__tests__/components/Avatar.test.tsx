import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Avatar } from '@/components/Avatar';

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
    // Allow http/https URLs, reject data URLs for testing
    return src?.startsWith('http://') || src?.startsWith('https://');
  },
}));

describe('Avatar Component', () => {
  describe('Image Loading States', () => {
    it('renders image when src is valid', async () => {
      const { container } = render(
        <Avatar
          src="https://example.com/avatar.jpg"
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      await waitFor(() => {
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('alt')).toBe("John Doe's profile picture");
      });
    });

    it('shows initials fallback when image fails to load', async () => {
      const { container } = render(
        <Avatar
          src="https://example.com/broken.jpg"
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      // Trigger error on the image
      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        expect(container.textContent).toContain('JD');
      });
    });

    it('shows initials fallback when src is null', () => {
      const { container } = render(
        <Avatar
          src={null}
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      expect(container.textContent).toContain('JD');
    });

    it('shows initials fallback when src is undefined', () => {
      const { container } = render(
        <Avatar
          src={undefined}
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      expect(container.textContent).toContain('JD');
    });

    it('shows initials fallback when src is empty string', () => {
      const { container } = render(
        <Avatar
          src=""
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      expect(container.textContent).toContain('JD');
    });

    it('resets error state when src changes', async () => {
      const { container, rerender } = render(
        <Avatar
          src="https://example.com/broken.jpg"
          alt="Profile picture"
          name="John Doe"
          size={48}
        />
      );

      // Trigger error
      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        expect(container.textContent).toContain('JD');
      });

      // Change to valid src
      rerender(
        <Avatar
          src="https://example.com/valid.jpg"
          alt="Profile picture"
          name="John Doe"
          size={48}
        />
      );

      await waitFor(() => {
        const newImg = container.querySelector('img');
        expect(newImg).toBeTruthy();
      });
    });
  });

  describe('Initials Fallback', () => {
    it('generates correct initials for full name', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="John Doe" size={48} />
      );

      expect(container.textContent).toContain('JD');
    });

    it('generates correct initials for single name', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Madonna" size={48} />
      );

      expect(container.textContent).toContain('MA');
    });

    it('generates correct initials for three names', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="John Michael Doe" size={48} />
      );

      // Should use first and last
      expect(container.textContent).toContain('JD');
    });

    it('handles name with extra whitespace', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="  John   Doe  " size={48} />
      );

      expect(container.textContent).toContain('JD');
    });

    it('generates initials in uppercase', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="john doe" size={48} />
      );

      expect(container.textContent).toContain('JD');
    });
  });

  describe('Species Fallback', () => {
    it('shows dog emoji for dog species', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Buddy" species="dog" size={48} />
      );

      expect(container.textContent).toContain('🐕');
    });

    it('shows cat emoji for cat species', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Whiskers" species="cat" size={48} />
      );

      expect(container.textContent).toContain('🐈');
    });

    it('shows bird emoji for bird species', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Tweety" species="bird" size={48} />
      );

      expect(container.textContent).toContain('🐦');
    });

    it('shows rabbit emoji for rabbit species', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Bugs" species="rabbit" size={48} />
      );

      expect(container.textContent).toContain('🐇');
    });

    it('shows paw emoji for other species', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Rex" species="other" size={48} />
      );

      expect(container.textContent).toContain('🐾');
    });

    it('prioritizes species over name initials', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Buddy" species="dog" size={48} />
      );

      // Should show emoji, not initials
      expect(container.textContent).toContain('🐕');
      expect(container.textContent).not.toContain('BU');
    });
  });

  describe('Generic User Icon Fallback', () => {
    it('shows user icon when no name or species provided', () => {
      const { container } = render(
        <Avatar src={null} alt="" size={48} />
      );

      // Should render SVG user icon
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  });

  describe('Layout Stability', () => {
    it('maintains consistent dimensions regardless of fallback state', () => {
      const size = 64;
      
      const { container, rerender } = render(
        <Avatar
          src="https://example.com/avatar.jpg"
          alt=""
          name="John Doe"
          size={size}
        />
      );

      const avatar1 = container.querySelector('[role="img"]') as HTMLElement;
      const width1 = avatar1?.style.width;
      const height1 = avatar1?.style.height;

      // Switch to fallback
      rerender(
        <Avatar
          src={null}
          alt=""
          name="John Doe"
          size={size}
        />
      );

      const avatar2 = container.querySelector('[role="img"]') as HTMLElement;
      const width2 = avatar2?.style.width;
      const height2 = avatar2?.style.height;

      expect(width1).toBe(width2);
      expect(height1).toBe(height2);
      expect(width1).toBe(`${size}px`);
      expect(height1).toBe(`${size}px`);
    });

    it('applies min-width and min-height to prevent collapse', () => {
      const size = 48;
      const { container } = render(
        <Avatar src={null} alt="" name="Test" size={size} />
      );

      const avatar = container.querySelector('[role="img"]') as HTMLElement;
      expect(avatar.style.minWidth).toBe(`${size}px`);
      expect(avatar.style.minHeight).toBe(`${size}px`);
    });
  });

  describe('Alt Text Semantics', () => {
    it('applies alt text to container for meaningful avatars', () => {
      const { container } = render(
        <Avatar
          src="https://example.com/avatar.jpg"
          alt="John Doe's profile picture"
          name="John Doe"
          size={48}
        />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.getAttribute('aria-label')).toBe("John Doe's profile picture");
    });

    it('does not apply aria-label for decorative avatars', () => {
      const { container } = render(
        <Avatar
          src="https://example.com/avatar.jpg"
          alt=""
          name="John Doe"
          size={48}
        />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.getAttribute('aria-label')).toBeNull();
    });
  });

  describe('Shape Variants', () => {
    it('applies circle shape by default', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Test" size={48} />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.className).toContain('circle');
    });

    it('applies rounded shape when specified', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Test" size={48} shape="rounded" />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.className).toContain('rounded');
    });

    it('applies square shape when specified', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Test" size={48} shape="square" />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.className).toContain('square');
    });
  });

  describe('Custom Sizing', () => {
    it('respects custom size prop', () => {
      const size = 128;
      const { container } = render(
        <Avatar src={null} alt="" name="Test" size={size} />
      );

      const avatar = container.querySelector('[role="img"]') as HTMLElement;
      expect(avatar.style.width).toBe(`${size}px`);
      expect(avatar.style.height).toBe(`${size}px`);
    });

    it('uses default size when not specified', () => {
      const { container } = render(
        <Avatar src={null} alt="" name="Test" />
      );

      const avatar = container.querySelector('[role="img"]') as HTMLElement;
      expect(avatar.style.width).toBe('48px'); // default size
      expect(avatar.style.height).toBe('48px');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Avatar
          src={null}
          alt=""
          name="Test"
          size={48}
          className="custom-class"
        />
      );

      const avatar = container.querySelector('[role="img"]');
      expect(avatar?.className).toContain('custom-class');
    });
  });

  describe('Deterministic Behavior', () => {
    it('produces same fallback for same inputs', () => {
      const { container: container1 } = render(
        <Avatar src={null} alt="" name="John Doe" size={48} />
      );

      const { container: container2 } = render(
        <Avatar src={null} alt="" name="John Doe" size={48} />
      );

      expect(container1.textContent).toBe(container2.textContent);
    });

    it('handles broken image consistently across re-renders', async () => {
      const { container, rerender } = render(
        <Avatar
          src="https://example.com/broken.jpg"
          alt=""
          name="John Doe"
          size={48}
        />
      );

      // Trigger error
      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }

      await waitFor(() => {
        expect(container.textContent).toContain('JD');
      });

      // Re-render with same props
      rerender(
        <Avatar
          src="https://example.com/broken.jpg"
          alt=""
          name="John Doe"
          size={48}
        />
      );

      // Should still show fallback
      expect(container.textContent).toContain('JD');
    });
  });
});
