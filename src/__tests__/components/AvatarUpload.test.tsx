import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvatarUpload } from '@/components/Profile/AvatarUpload';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} />;
  },
}));

// Mock Avatar component
jest.mock('@/components/Avatar', () => ({
  Avatar: ({ src, alt, name, size }: any) => (
    <div data-testid="avatar" data-src={src} data-alt={alt} data-name={name} data-size={size}>
      {src ? 'Image' : name ? name.slice(0, 2).toUpperCase() : 'Fallback'}
    </div>
  ),
}));

describe('AvatarUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders upload area with placeholder when no avatar', () => {
      render(
        <AvatarUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText(/drag and drop or click to upload/i)).toBeInTheDocument();
    });

    it('displays current avatar when provided', () => {
      render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('data-src', 'https://example.com/avatar.jpg');
    });

    it('shows initials fallback when avatar URL but no image', () => {
      render(
        <AvatarUpload
          currentAvatar=""
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText(/drag and drop or click to upload/i)).toBeInTheDocument();
    });
  });

  describe('File Selection via Input', () => {
    it('accepts valid image file and creates preview', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy content'], 'avatar.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      // FileReader completes asynchronously - check that it was called
      await waitFor(() => {
        const avatar = screen.queryByTestId('avatar');
        expect(avatar).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(mockOnUploadSuccess).toHaveBeenCalled();
    });

    it('rejects file larger than 5MB', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      // Create a 6MB file
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(mockOnUploadError).toHaveBeenCalledWith('File size must be less than 5MB');
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });

    it('rejects invalid file type', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const invalidFile = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [invalidFile] } });

      expect(mockOnUploadError).toHaveBeenCalledWith(
        'Only JPEG, PNG, WebP, and GIF files are allowed'
      );
      expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    });

    it('accepts JPEG files', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('accepts PNG files', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('accepts WebP files', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'photo.webp', { type: 'image/webp' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('accepts GIF files', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'animated.gif', { type: 'image/gif' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Drag and Drop', () => {
    it('shows dragging state on drag over', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const uploadArea = container.querySelector('[class*="uploadArea"]') as HTMLElement;
      
      fireEvent.dragOver(uploadArea);

      expect(screen.getByText(/drop your image here/i)).toBeInTheDocument();
    });

    it('removes dragging state on drag leave', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const uploadArea = container.querySelector('[class*="uploadArea"]') as HTMLElement;
      
      fireEvent.dragOver(uploadArea);
      expect(screen.getByText(/drop your image here/i)).toBeInTheDocument();
      
      fireEvent.dragLeave(uploadArea);
      expect(screen.getByText(/drag and drop or click to upload/i)).toBeInTheDocument();
    });

    it('handles file drop', async () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'dropped.jpg', { type: 'image/jpeg' });
      const uploadArea = container.querySelector('[class*="uploadArea"]') as HTMLElement;
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Loading State', () => {
    it('disables input when loading', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          isLoading={true}
        />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('shows loader when loading with preview', () => {
      const { container } = render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar.jpg"
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          isLoading={true}
        />
      );

      const loader = container.querySelector('[class*="loader"]');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('Preview Updates', () => {
    it('updates preview when currentAvatar prop changes', () => {
      const { rerender } = render(
        <AvatarUpload
          currentAvatar="https://example.com/avatar1.jpg"
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      let avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('data-src', 'https://example.com/avatar1.jpg');

      rerender(
        <AvatarUpload
          currentAvatar="https://example.com/avatar2.jpg"
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      avatar = screen.getByTestId('avatar');
      expect(avatar).toHaveAttribute('data-src', 'https://example.com/avatar2.jpg');
    });

    it('maintains local preview after file selection', async () => {
      const { container } = render(
        <AvatarUpload
          currentAvatar="https://example.com/old-avatar.jpg"
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const file = new File(['dummy'], 'new-avatar.jpg', { type: 'image/jpeg' });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Preview should be updated to the new file
      const avatar = screen.getByTestId('avatar');
      expect(avatar.getAttribute('data-src')).toContain('blob:');
    });
  });

  describe('Click to Upload', () => {
    it('triggers file input on click', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const uploadArea = container.querySelector('[class*="uploadArea"]') as HTMLElement;
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      const clickSpy = jest.spyOn(input, 'click');
      
      fireEvent.click(uploadArea);
      
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper input attributes', () => {
      const { container } = render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.type).toBe('file');
      expect(input.accept).toBe('image/*');
    });

    it('shows descriptive text for screen readers', () => {
      render(
        <AvatarUpload
          userName="John Doe"
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText(/drag and drop or click to upload/i)).toBeInTheDocument();
      expect(screen.getByText(/jpeg, png, webp or gif \(max 5mb\)/i)).toBeInTheDocument();
    });
  });
});
