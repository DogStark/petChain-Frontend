import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PhotoGallery } from '../PhotoGallery';
import type { PetPhoto } from '@/lib/api/petPhotosAPI';

function photo(id: string, name: string, isPrimary = false): PetPhoto {
  return {
    id,
    petId: 'pet-1',
    photoUrl: `https://example.test/${id}.jpg`,
    thumbnailUrl: `https://example.test/${id}-thumb.jpg`,
    isPrimary,
    displayOrder: 0,
    mimeType: 'image/jpeg',
    fileSize: 1024,
    width: 800,
    height: 800,
    originalFilename: name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const photos = [
  photo('a', 'alpha.jpg', true),
  photo('b', 'bravo.jpg'),
  photo('c', 'charlie.jpg'),
];

function renderGallery(onReorder = jest.fn()) {
  render(
    <PhotoGallery
      photos={photos}
      onSetPrimary={jest.fn()}
      onDelete={jest.fn()}
      onReorder={onReorder}
    />,
  );
  return onReorder;
}

describe('PhotoGallery keyboard reorder controls', () => {
  it('disables moving the first photo up and the last photo down', () => {
    renderGallery();

    expect(screen.getByRole('button', { name: /move alpha\.jpg up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move alpha\.jpg down/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /move charlie\.jpg up/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /move charlie\.jpg down/i })).toBeDisabled();
  });

  it('moves a photo down and reports the new order', () => {
    const onReorder = renderGallery();

    fireEvent.click(screen.getByRole('button', { name: /move alpha\.jpg down/i }));

    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('moves a photo up and reports the new order', () => {
    const onReorder = renderGallery();

    fireEvent.click(screen.getByRole('button', { name: /move charlie\.jpg up/i }));

    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('announces the resulting position to assistive technology', () => {
    renderGallery();
    const listener = jest.fn();
    window.addEventListener('petchain-announcement', listener);

    fireEvent.click(screen.getByRole('button', { name: /move alpha\.jpg down/i }));

    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0][0] as CustomEvent<{ message: string }>;
    expect(event.detail.message).toBe('Photo moved down to position 2 of 3.');

    window.removeEventListener('petchain-announcement', listener);
  });

  it('does not fire a reorder when a move would leave the gallery', () => {
    const onReorder = renderGallery();
    const firstUp = screen.getByRole('button', { name: /move alpha\.jpg up/i });

    fireEvent.click(firstUp);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('renders the empty state when there are no photos', () => {
    render(
      <PhotoGallery
        photos={[]}
        onSetPrimary={jest.fn()}
        onDelete={jest.fn()}
        onReorder={jest.fn()}
      />,
    );

    expect(screen.getByText(/no photos yet/i)).toBeInTheDocument();
  });
});
