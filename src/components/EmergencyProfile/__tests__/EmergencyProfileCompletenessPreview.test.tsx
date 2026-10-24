import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { EmergencyProfileCompletenessPreview } from '../EmergencyProfileCompletenessPreview';
import { PetEmergencyInfo } from '@/types/pet';

const mixedProfile: PetEmergencyInfo = {
  petId: 'pet-123',
  medicalNotes: 'Allergic to penicillin.',
  contacts: [
    { id: 'c1', name: 'Jane', relationship: 'Owner', phone: '+1-555-0199', priority: 1 },
  ],
  emergencyVet: {
    name: 'Downtown Vet',
    phone: '+1-555-0911',
    address: '100 Main St',
    is24Hours: true,
  },
  poisonControl: {
    name: 'APCC',
    phone: '+1-888-426-4435',
    isPublic: true,
  },
  visibility: {
    medicalNotes: false,
    contacts: false,
    emergencyVet: false,
    poisonControl: true,
    customMessage: false,
  },
};

describe('EmergencyProfileCompletenessPreview', () => {
  it('renders a heading describing the public scan', () => {
    render(<EmergencyProfileCompletenessPreview profile={mixedProfile} />);
    expect(
      screen.getByRole('heading', { name: /what the public scan will show/i })
    ).toBeInTheDocument();
  });

  it('labels each field as Shown or Hidden with screen-reader text', () => {
    render(<EmergencyProfileCompletenessPreview profile={mixedProfile} />);
    // Only poison control is public + populated:
    expect(
      screen.getByLabelText(/poison control will be shown on the public scan/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/medical notes is hidden from the public scan/i)
    ).toBeInTheDocument();
  });

  it('announces how many fields are visible', () => {
    render(<EmergencyProfileCompletenessPreview profile={mixedProfile} />);
    expect(
      screen.getByText(/1 of 5 field categories will appear/i)
    ).toBeInTheDocument();
  });

  it('handles the empty / denied state without crashing', () => {
    render(<EmergencyProfileCompletenessPreview profile={null} />);
    expect(
      screen.getByText(/no emergency fields are currently visible/i)
    ).toBeInTheDocument();
    // Still lists every category as Hidden:
    expect(
      screen.getAllByLabelText(/is hidden from the public scan/i).length
    ).toBeGreaterThan(0);
  });

  it('shows all categories when everything is public and populated', () => {
    const allPublic: PetEmergencyInfo = {
      ...mixedProfile,
      visibility: {
        medicalNotes: true,
        contacts: true,
        emergencyVet: true,
        poisonControl: true,
        customMessage: true,
      },
    };
    render(<EmergencyProfileCompletenessPreview profile={allPublic} />);
    expect(
      screen.getByText(/5 of 5 field categories will appear/i)
    ).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <EmergencyProfileCompletenessPreview profile={mixedProfile} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
