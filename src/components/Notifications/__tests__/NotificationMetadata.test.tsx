import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationItem } from '../NotificationItem';
import { parseNotificationMetadata } from '@/types/notification';

const notification = {
  id: 'notification-test',
  title: 'Update',
  message: 'A sample update',
  category: 'SYSTEM',
  isRead: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  actionUrl: null,
} as const;

describe('notification metadata validation', () => {
  it('ignores unknown metadata types instead of passing unsafe data to the renderer', () => {
    const metadata = parseNotificationMetadata({
      type: 'UNRECOGNIZED',
      imageUrl: 'https://example.invalid/image.png',
    });

    expect(metadata).toBeNull();
    expect(() =>
      render(
        <NotificationItem
          notification={{ ...notification, metadata }}
          onMarkAsRead={jest.fn()}
        />,
      ),
    ).not.toThrow();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rejects non-object metadata and preserves valid typed image metadata', () => {
    expect(parseNotificationMetadata('unexpected')).toBeNull();
    expect(parseNotificationMetadata({ type: 'SYSTEM', imageUrl: 42 })).toEqual({
      type: 'SYSTEM',
      imageUrl: undefined,
    });

    const metadata = parseNotificationMetadata({
      type: 'SYSTEM',
      imageUrl: 'https://example.invalid/image.png',
    });
    expect(metadata).toEqual({ type: 'SYSTEM', imageUrl: 'https://example.invalid/image.png' });
    render(
      <NotificationItem
        notification={{ ...notification, metadata }}
        onMarkAsRead={jest.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Notification attachment' })).toHaveAttribute(
      'src',
      'https://example.invalid/image.png',
    );
  });
});
