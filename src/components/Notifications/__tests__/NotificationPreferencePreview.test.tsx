import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NotificationPreferencePreview } from '../NotificationPreferencePreview';
import {
  DEFAULT_PREFERENCES,
  NotificationCategory,
  NotificationPreferences,
} from '@/types/notification';

function withCategories(enabled: NotificationCategory[]): NotificationPreferences {
  const categories = Object.fromEntries(
    (Object.keys(DEFAULT_PREFERENCES.categories) as NotificationCategory[]).map(
      (cat) => [cat, enabled.includes(cat)]
    )
  ) as Record<NotificationCategory, boolean>;
  return { ...DEFAULT_PREFERENCES, categories };
}

describe('NotificationPreferencePreview', () => {
  it('renders a heading describing the preview', () => {
    render(<NotificationPreferencePreview preferences={DEFAULT_PREFERENCES} />);
    expect(
      screen.getByRole('heading', { name: /preview before you save/i })
    ).toBeInTheDocument();
  });

  it('announces a delivery summary for the default preferences', () => {
    render(<NotificationPreferencePreview preferences={DEFAULT_PREFERENCES} />);
    expect(
      screen.getByText(/you will receive 9 event types/i)
    ).toBeInTheDocument();
  });

  it('lists the enabled channels with representative samples', () => {
    render(<NotificationPreferencePreview preferences={DEFAULT_PREFERENCES} />);
    // in-app, sound, vibration are on by default; browser push is off.
    expect(screen.getByText(/In-app:/i)).toBeInTheDocument();
    expect(screen.getByText(/Sound:/i)).toBeInTheDocument();
    expect(screen.getByText(/Vibration:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Browser push:/i)).not.toBeInTheDocument();
  });

  it('lists the exact event categories that will trigger delivery', () => {
    render(
      <NotificationPreferencePreview
        preferences={withCategories(['APPOINTMENT', 'LOST_PET', 'MEDICATION'])}
      />
    );
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Lost Pet')).toBeInTheDocument();
    expect(screen.getByText('Medications')).toBeInTheDocument();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when no event type is enabled (denied/empty)', () => {
    render(<NotificationPreferencePreview preferences={withCategories([])} />);
    expect(
      screen.getByText(/turn on at least one event type/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no event types are enabled/i)
    ).toBeInTheDocument();
  });

  it('reflects Do Not Disturb quiet hours in the live summary', () => {
    render(
      <NotificationPreferencePreview
        preferences={{
          ...DEFAULT_PREFERENCES,
          doNotDisturb: true,
          dndStart: '22:00',
          dndEnd: '08:00',
          timezone: 'America/New_York',
        }}
      />
    );
    expect(screen.getByText(/quiet hours/i)).toBeInTheDocument();
    expect(screen.getByText(/22:00/i)).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <NotificationPreferencePreview preferences={DEFAULT_PREFERENCES} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
