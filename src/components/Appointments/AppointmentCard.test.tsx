import { render, screen } from '@testing-library/react';
import React from 'react';

import { I18nProvider } from '@/i18n';
import type { Appointment } from '@/types/appointments';

import AppointmentCard from './AppointmentCard';

const appointment: Appointment = {
  id: 'appointment-1',
  petId: 'pet-1',
  vetId: 'vet-1',
  appointmentType: 'Checkup',
  scheduledAt: '2026-09-25T10:00:00.000Z',
  duration: 1,
  status: 'Scheduled',
  reminderSent: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('AppointmentCard duration formatting', () => {
  it('uses localized singular and plural minute units', () => {
    const { rerender } = render(
      <I18nProvider>
        <AppointmentCard appointment={appointment} vetName="Dr. Smith" petName="Milo" />
      </I18nProvider>,
    );

    expect(screen.getByText(/\(1 minute\)/)).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <AppointmentCard
          appointment={{ ...appointment, duration: 2 }}
          vetName="Dr. Smith"
          petName="Milo"
        />
      </I18nProvider>,
    );

    expect(screen.getByText(/\(2 minutes\)/)).toBeInTheDocument();
  });
});