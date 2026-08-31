import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EmergencyAccessPage from '@/pages/pets/[id]/emergency';
import { petAPI } from '@/lib/api/petAPI';
import { PetEmergencyInfo } from '@/types/pet';

const mockPush = jest.fn();

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { id: 'pet-123' },
    push: mockPush,
  }),
}));

jest.mock('@/lib/api/petAPI', () => ({
  petAPI: {
    getPetEmergencyInfo: jest.fn(),
    getPetEmergencyInfoProjection: jest.fn(),
    updatePetEmergencyInfo: jest.fn(),
  },
}));

const mockEmergencyData: PetEmergencyInfo = {
  petId: 'pet-123',
  medicalNotes: 'Allergic to Penicillin. Needs EpiPen.',
  contacts: [
    {
      id: 'c1',
      name: 'Alice Johnson',
      relationship: 'Primary Owner',
      phone: '+1-555-123-4567',
      email: 'alice@example.com',
      priority: 1,
      isPublic: false,
    },
  ],
  emergencyVet: {
    name: '24/7 Vet Emergency Clinic',
    phone: '+1-555-999-8888',
    address: '456 Vet Blvd, Cityville',
    is24Hours: true,
    notes: 'Direct entrance on right.',
    isPublic: false,
  },
  poisonControl: {
    name: 'Pet Poison Helpline',
    phone: '+1-800-213-6680',
    website: 'https://petpoisonhelpline.com',
    isPublic: true,
  },
  visibility: {
    medicalNotes: false, // private by default
    contacts: false,     // private by default
    emergencyVet: false, // private by default
    poisonControl: true, // public
  },
};

describe('EmergencyAccessPage with Field Visibility & Scanner Preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state while fetching records', () => {
    (petAPI.getPetEmergencyInfo as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<EmergencyAccessPage />);
    expect(
      screen.getByRole('status') ||
      screen.getByText(/loading emergency record/i) ||
      document.querySelector('.animate-spin')
    ).toBeTruthy();
  });

  it('renders error / access denied state on failure with return home button', async () => {
    (petAPI.getPetEmergencyInfo as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<EmergencyAccessPage />);

    await waitFor(() => {
      expect(screen.getByText(/Emergency Access Denied/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();

    const returnBtn = screen.getByRole('button', { name: /return home/i });
    fireEvent.click(returnBtn);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders full owner view with visibility status badges/toggles', async () => {
    (petAPI.getPetEmergencyInfo as jest.Mock).mockResolvedValue(mockEmergencyData);
    render(<EmergencyAccessPage />);

    await waitFor(() => {
      expect(screen.getByText(/Emergency Record/i)).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('24/7 Vet Emergency Clinic')).toBeInTheDocument();
    });

    // Medical notes shown in owner view
    expect(screen.getByText(/Allergic to Penicillin/i)).toBeInTheDocument();
  });

  it('switches to Anonymous Scanner Preview mode and hides private fields', async () => {
    (petAPI.getPetEmergencyInfo as jest.Mock).mockResolvedValue(mockEmergencyData);
    render(<EmergencyAccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Find the preview tab button
    const previewTab = screen.getByRole('tab', { name: /scanner preview/i });
    fireEvent.click(previewTab);

    // In anonymous preview:
    // Medical notes (private) is hidden
    expect(screen.queryByText(/Allergic to Penicillin/i)).not.toBeInTheDocument();
    // Contacts (private) is hidden
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    // Vet (private) is hidden
    expect(screen.queryByText('24/7 Vet Emergency Clinic')).not.toBeInTheDocument();
    // Poison control (public) is visible
    expect(screen.getByText('Pet Poison Helpline')).toBeInTheDocument();
  });

  it('toggling a field visibility updates the anonymous preview live', async () => {
    (petAPI.getPetEmergencyInfo as jest.Mock).mockResolvedValue(mockEmergencyData);
    (petAPI.updatePetEmergencyInfo as jest.Mock).mockResolvedValue(mockEmergencyData);

    render(<EmergencyAccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Toggle medical notes to public
    const medToggle = screen.getByTestId('toggle-medicalNotes');
    fireEvent.click(medToggle);

    // Switch to preview mode
    const previewTab = screen.getByRole('tab', { name: /scanner preview/i });
    fireEvent.click(previewTab);

    // Now medical notes should be visible in the anonymous preview!
    expect(screen.getByText(/Allergic to Penicillin/i)).toBeInTheDocument();
  });

  it('handles empty state when no emergency fields are visible in anonymous preview', async () => {
    const allPrivateData: PetEmergencyInfo = {
      ...mockEmergencyData,
      poisonControl: undefined,
      visibility: {
        medicalNotes: false,
        contacts: false,
        emergencyVet: false,
        poisonControl: false,
      },
    };

    (petAPI.getPetEmergencyInfo as jest.Mock).mockResolvedValue(allPrivateData);
    render(<EmergencyAccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    const previewTab = screen.getByRole('tab', { name: /scanner preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText(/No emergency info visible to anonymous scanners/i)).toBeInTheDocument();
  });
});
