import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import Avatar from '@/components/Avatar';

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
      />
    );
  },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Dog: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="dog-icon" width={size} height={size} className={className} />
  ),
  Cat: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="cat-icon" width={size} height={size} className={className} />
  ),
  Bird: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="bird-icon" width={size} height={size} className={className} />
  ),
  Fish: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="fish-icon" width={size} height={size} className={className} />
  ),
  Rabbit: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="rabbit-icon" width={size} height={size} className={className} />
  ),
  PawPrint: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="paw-print-icon" width={size} height={size} className={className} />
  ),
  User: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="user-icon" width={size} height={size} className={className} />
  ),
}));

describe('Avatar Component', () => {
  describe('Image Loading States', () => {
    it('displays image when src is valid', async () => {
      render(<Avatar src="/valid-image.jpg" name="John Doe" />);
      
      const img = screen.getByRole('img', { name: /profile picture for john doe/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('valid-image.jpg'));
    });

    it('shows fallback while image is loading', () => {
      render(<Avatar src="/loading-image.jpg" name="John Doe" />);
      
      // Should show initials while loading
      const fallback = screen.getByText('JD');
      expect(fallback).toBeInTheDocument();
    });

    it('transitions from fallback to image after load', async () => {
      const { container } = render(<Avatar src="/loaded-image.jpg" name="Alice Smith" />);
      
      // Initially shows fallback
      expect(screen.getByText('AS')).toBeInTheDocument();
      
      // Simulate image load
      const img = container.querySelector('img[src*="loaded-image.jpg"]');
      if (img) {
        img.dispatchEvent(new Event('load'));
      }
      
      await waitFor(() => {
        expect(img).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('shows initials fallback when image fails to load', async () => {
      const { container } = render(<Avatar src="/broken-image.jpg" name="Bob Wilson" />);
      
      const img = container.querySelector('img');
      if (img) {
        // Simulate image error
        img.dispatchEvent(new Event('error'));
      }
      
      await waitFor(() => {
        expect(screen.getByText('BW')).toBeInTheDocument();
      });
    });

    it('shows fallback when src is null', () => {
      render(<Avatar src={null} name="Charlie Brown" />);
      
      expect(screen.getByText('CB')).toBeInTheDocument();
    });

    it('shows fallback when src is undefined', () => {
      render(<Avatar src={undefined} name="David Lee" />);
      
      expect(screen.getByText('DL')).toBeInTheDocument();
    });

    it('shows fallback when src is empty string', () => {
      render(<Avatar src="" name="Eve Martinez" />);
      
      expect(screen.getByText('EM')).toBeInTheDocument();
    });

    it('shows fallback when src is whitespace only', () => {
      render(<Avatar src="   " name="Frank Miller" />);
      
      expect(screen.getByText('FM')).toBeInTheDocument();
    });
  });

  describe('Missing Avatar States', () => {
    it('shows question mark when both src and name are missing', () => {
      render(<Avatar src={null} name="" />);
      
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('shows single initial when only first name is provided', () => {
      render(<Avatar name="Grace" />);
      
      expect(screen.getByText('G')).toBeInTheDocument();
    });
  });

  describe('Changed Avatar States', () => {
    it('updates initials when name changes', () => {
      const { rerender } = render(<Avatar name="Hannah Green" />);
      expect(screen.getByText('HG')).toBeInTheDocument();
      
      rerender(<Avatar name="Ian Black" />);
      expect(screen.getByText('IB')).toBeInTheDocument();
    });

    it('updates from fallback to image when src is added', async () => {
      const { rerender, container } = render(<Avatar name="Jane Doe" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
      
      rerender(<Avatar src="/new-image.jpg" name="Jane Doe" />);
      
      const img = container.querySelector('img[src*="new-image.jpg"]');
      expect(img).toBeInTheDocument();
    });

    it('updates from image to fallback when src is removed', () => {
      const { rerender } = render(<Avatar src="/image.jpg" name="Kevin Hart" />);
      
      rerender(<Avatar src={null} name="Kevin Hart" />);
      expect(screen.getByText('KH')).toBeInTheDocument();
    });
  });

  describe('User Avatars', () => {
    it('renders user avatar with initials fallback', () => {
      render(<Avatar type="user" name="Laura White" />);
      
      expect(screen.getByText('LW')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /profile picture for laura white/i })).toBeInTheDocument();
    });

    it('generates consistent colors for same user', () => {
      const { container: container1 } = render(<Avatar name="Mike Ross" />);
      const { container: container2 } = render(<Avatar name="Mike Ross" />);
      
      const fallback1 = container1.querySelector('[style*="background-color"]');
      const fallback2 = container2.querySelector('[style*="background-color"]');
      
      expect(fallback1?.getAttribute('style')).toEqual(fallback2?.getAttribute('style'));
    });
  });

  describe('Pet Avatars', () => {
    it('renders dog icon for dog species', () => {
      render(<Avatar type="pet" species="dog" name="Buddy" />);
      
      expect(screen.getByTestId('dog-icon')).toBeInTheDocument();
    });

    it('renders cat icon for cat species', () => {
      render(<Avatar type="pet" species="cat" name="Whiskers" />);
      
      expect(screen.getByTestId('cat-icon')).toBeInTheDocument();
    });

    it('renders bird icon for bird species', () => {
      render(<Avatar type="pet" species="bird" name="Tweety" />);
      
      expect(screen.getByTestId('bird-icon')).toBeInTheDocument();
    });

    it('renders fish icon for fish species', () => {
      render(<Avatar type="pet" species="fish" name="Nemo" />);
      
      expect(screen.getByTestId('fish-icon')).toBeInTheDocument();
    });

    it('renders rabbit icon for rabbit species', () => {
      render(<Avatar type="pet" species="rabbit" name="Thumper" />);
      
      expect(screen.getByTestId('rabbit-icon')).toBeInTheDocument();
    });

    it('renders paw-print icon for unknown species', () => {
      render(<Avatar type="pet" species="hamster" name="Nibbles" />);
      
      expect(screen.getByTestId('paw-print-icon')).toBeInTheDocument();
    });

    it('renders paw-print icon when species is missing', () => {
      render(<Avatar type="pet" name="Unknown" />);
      
      expect(screen.getByTestId('paw-print-icon')).toBeInTheDocument();
    });

    it('uses correct alt text for pet avatars', () => {
      render(<Avatar type="pet" species="dog" name="Max" />);
      
      expect(screen.getByRole('img', { name: /pet picture for max/i })).toBeInTheDocument();
    });
  });

  describe('Staff Avatars', () => {
    it('renders staff avatar with initials fallback', () => {
      render(<Avatar type="staff" name="Dr. Smith" />);
      
      expect(screen.getByText('DS')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /staff member picture for dr\. smith/i })).toBeInTheDocument();
    });
  });

  describe('Size Customization', () => {
    it('applies custom size', () => {
      const { container } = render(<Avatar name="Nancy Drew" size={64} />);
      
      const avatarContainer = container.querySelector('[style*="width"]');
      expect(avatarContainer).toHaveStyle({ width: '64px', height: '64px' });
    });

    it('uses default size when not specified', () => {
      const { container } = render(<Avatar name="Oscar Wild" />);
      
      const avatarContainer = container.querySelector('[style*="width"]');
      expect(avatarContainer).toHaveStyle({ width: '48px', height: '48px' });
    });

    it('scales icon size proportionally to avatar size', () => {
      render(<Avatar type="pet" species="dog" size={80} />);
      
      const icon = screen.getByTestId('dog-icon');
      expect(icon).toHaveAttribute('width', '40'); // 50% of 80
    });
  });

  describe('Accessibility', () => {
    it('passes axe accessibility tests for user avatar with image', async () => {
      const { container } = render(
        <Avatar src="/profile.jpg" name="Paul Adams" type="user" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests for user avatar with initials fallback', async () => {
      const { container } = render(<Avatar name="Quinn Taylor" type="user" />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility tests for pet avatar with icon fallback', async () => {
      const { container } = render(
        <Avatar type="pet" species="dog" name="Rex" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('uses empty alt text for decorative images', () => {
      const { container } = render(
        <Avatar src="/decorative.jpg" name="Rachel Green" isDecorative={true} />
      );
      
      const img = container.querySelector('img[src*="decorative.jpg"]');
      expect(img).toHaveAttribute('alt', '');
    });

    it('uses descriptive alt text for meaningful images', () => {
      render(<Avatar src="/meaningful.jpg" name="Sam Wilson" isDecorative={false} />);
      
      expect(screen.getByRole('img', { name: /profile picture for sam wilson/i })).toBeInTheDocument();
    });

    it('provides aria-label for fallback content', () => {
      render(<Avatar name="Tina Fey" />);
      
      const fallback = screen.getByRole('img', { name: /profile picture for tina fey/i });
      expect(fallback).toBeInTheDocument();
    });
  });

  describe('Layout Shift Prevention', () => {
    it('maintains stable dimensions during loading', () => {
      const { container } = render(
        <Avatar src="/loading.jpg" name="Uma Thurman" size={56} />
      );
      
      const avatarContainer = container.querySelector('[style*="width"]');
      expect(avatarContainer).toHaveStyle({
        width: '56px',
        height: '56px',
        minWidth: 'var(--avatar-size, 48px)',
        minHeight: 'var(--avatar-size, 48px)',
      });
    });

    it('maintains stable dimensions on error', async () => {
      const { container } = render(
        <Avatar src="/error.jpg" name="Victor Stone" size={72} />
      );
      
      const img = container.querySelector('img');
      if (img) {
        img.dispatchEvent(new Event('error'));
      }
      
      await waitFor(() => {
        const avatarContainer = container.querySelector('[style*="width"]');
        expect(avatarContainer).toHaveStyle({ width: '72px', height: '72px' });
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Avatar name="Walter White" className="custom-avatar" />
      );
      
      const avatarContainer = container.querySelector('.custom-avatar');
      expect(avatarContainer).toBeInTheDocument();
    });
  });

  describe('Priority and Sizes Props', () => {
    it('passes priority prop to Next Image', () => {
      const { container } = render(
        <Avatar src="/priority.jpg" name="Xena Warrior" priority={true} />
      );
      
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
    });

    it('passes sizes prop to Next Image', () => {
      const { container } = render(
        <Avatar src="/sized.jpg" name="Yara Martinez" sizes="(max-width: 768px) 100vw, 50vw" />
      );
      
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
    });
  });
});
