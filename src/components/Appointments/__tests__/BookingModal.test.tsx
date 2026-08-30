import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingModal from '../BookingModal';
import { appointmentsAPI } from '@/lib/api/appointmentsAPI';
import '@testing-library/jest-dom';

jest.mock('@/lib/api/appointmentsAPI', () => ({
  appointmentsAPI: {
    createAppointment: jest.fn(),
  },
}));

jest.mock('@/hooks/useHaptic', () => ({
  useHaptic: () => ({ trigger: jest.fn() }),
}));

describe('BookingModal Conflict Handling', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText(/select pet/i), { target: { value: 'pet1' } });
    fireEvent.change(screen.getByLabelText(/veterinarian/i), { target: { value: 'vet1' } });
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-10-10' } });
  };

  it('displays alternate slots when a 409 conflict occurs', async () => {
    const errorResponse = {
      response: {
        status: 409,
        data: {
          message: 'The selected time slot is no longer available.',
          availableSlots: ['10:30', '11:00', '14:00'],
        },
      },
    };
    (appointmentsAPI.createAppointment as jest.Mock).mockRejectedValueOnce(errorResponse);

    render(<BookingModal onClose={mockOnClose} />);

    fillForm();

    const submitButton = screen.getByRole('button', { name: /confirm booking/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('The selected time slot is no longer available.')).toBeInTheDocument();
      expect(screen.getByText('10:30')).toBeInTheDocument();
      expect(screen.getByText('11:00')).toBeInTheDocument();
      expect(screen.getByText('14:00')).toBeInTheDocument();
    });

    // Verify form fields are preserved
    expect(screen.getByLabelText(/select pet/i)).toHaveValue('pet1');
    expect(screen.getByLabelText(/veterinarian/i)).toHaveValue('vet1');
    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-10-10');
  });

  it('updates time and clears conflict slots when an alternate slot is selected', async () => {
    const errorResponse = {
      response: {
        status: 409,
        data: {
          message: 'The selected time slot is no longer available.',
          availableSlots: ['10:30', '11:00', '14:00'],
        },
      },
    };
    (appointmentsAPI.createAppointment as jest.Mock)
      .mockRejectedValueOnce(errorResponse)
      .mockResolvedValueOnce({});

    render(<BookingModal onClose={mockOnClose} />);

    fillForm();

    const submitButton = screen.getByRole('button', { name: /confirm booking/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('10:30')).toBeInTheDocument();
    });

    // Click on the alternate slot
    fireEvent.click(screen.getByText('10:30'));

    // Should update time and hide alternate slots
    expect(screen.queryByText('10:30')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/time/i)).toHaveValue('10:30');
    expect(screen.queryByText('The selected time slot is no longer available.')).not.toBeInTheDocument();

    // Submit again, should succeed
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(appointmentsAPI.createAppointment).toHaveBeenCalledTimes(2);
      expect(appointmentsAPI.createAppointment).toHaveBeenLastCalledWith(expect.objectContaining({
        time: '10:30',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
