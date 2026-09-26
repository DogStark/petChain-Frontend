import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SurgeryForm } from '../SurgeryForm';
import { surgeryAPI } from '@/lib/api/surgeryAPI';
import '@testing-library/jest-dom';

jest.mock('@/lib/api/surgeryAPI', () => ({
  surgeryAPI: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
const mockOnCancel = jest.fn();

const defaultProps = {
  petId: 'pet-123',
  petDateOfBirth: '2020-01-01',
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSubmit.mockClear();
  mockOnCancel.mockClear();
});

describe('SurgeryForm date validation', () => {
  it('blocks submit when surgery date is in the future', async () => {
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    render(<SurgeryForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });
    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: futureDateStr },
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/surgery date cannot be in the future/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('blocks submit when surgery date is before the pet\'s birth date', async () => {
    render(<SurgeryForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });
    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: '2019-06-15' },
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/surgery date must be after the pet's birth date/i),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('allows submit when surgery date is today', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    render(<SurgeryForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: todayStr },
    });

    // Clear required field errors by filling surgery type
    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('allows submit when surgery date equals the pet\'s birth date (exact boundary)', async () => {
    render(<SurgeryForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: '2020-01-01' },
    });

    // Clear required field errors by filling surgery type
    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('clears the date error when the user changes the date to a valid one', async () => {
    render(<SurgeryForm {...defaultProps} />);

    // Fill in surgery type first
    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });

    // Set a future date first
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: futureDateStr },
    });

    // Submit to trigger the error
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/surgery date cannot be in the future/i)).toBeInTheDocument();
    });

    // Now change to a valid date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: todayStr },
    });

    // Error should be cleared
    expect(screen.queryByText(/surgery date cannot be in the future/i)).not.toBeInTheDocument();
  });

  it('does not show birth date error when petDateOfBirth is not provided', async () => {
    render(<SurgeryForm petId="pet-123" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    fireEvent.change(screen.getByLabelText(/surgery type/i), {
      target: { value: 'Spay' },
    });

    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/surgery date/i), {
      target: { value: futureDateStr },
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/surgery date cannot be in the future/i)).toBeInTheDocument();
    });
  });
});
