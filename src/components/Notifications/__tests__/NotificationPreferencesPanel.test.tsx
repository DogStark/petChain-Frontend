import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import NotificationPreferencesPanel from '@/components/Notifications/NotificationPreferencesPanel';
import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '@/types/notification';

// ─── Mock context ─────────────────────────────────────────────────────────────

const ctx: Record<string, unknown> = {
  preferences: { ...DEFAULT_PREFERENCES, doNotDisturb: true },
  updatePreferences: jest.fn(),
  syncPreferences: jest.fn(),
  requestBrowserPermission: jest.fn(),
  preferencesSyncStatus: 'idle',
};

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ctx,
}));

function setPreferences(preferences: NotificationPreferences) {
  ctx.preferences = preferences;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationPreferencesPanel — DND timezone', () => {
  beforeEach(() => {
    setPreferences({ ...DEFAULT_PREFERENCES, doNotDisturb: true });
    (ctx.updatePreferences as jest.Mock).mockClear();
  });

  it('shows a timezone selector when DND is enabled', () => {
    render(<NotificationPreferencesPanel />);
    const select = screen.getByLabelText('Timezone');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue(DEFAULT_PREFERENCES.timezone);
  });

  it('does not show the timezone selector when DND is disabled', () => {
    setPreferences({ ...DEFAULT_PREFERENCES, doNotDisturb: false });
    render(<NotificationPreferencesPanel />);
    expect(screen.queryByLabelText('Timezone')).not.toBeInTheDocument();
  });

  it('updates the stored timezone when the user picks one', () => {
    render(<NotificationPreferencesPanel />);
    fireEvent.change(screen.getByLabelText('Timezone'), {
      target: { value: 'America/New_York' },
    });
    expect(ctx.updatePreferences).toHaveBeenCalledWith({ timezone: 'America/New_York' });
  });

  it('reflects the stored timezone as the selected value', () => {
    setPreferences({ ...DEFAULT_PREFERENCES, doNotDisturb: true, timezone: 'Asia/Tokyo' });
    render(<NotificationPreferencesPanel />);
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Tokyo');
  });
});
