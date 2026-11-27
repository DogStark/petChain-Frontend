import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import EmergencyResponderFeedback from '@/components/EmergencyResponderFeedback';
import { qrcodeAPI } from '@/lib/api/qrcodeAPI';

jest.mock('@/lib/api/qrcodeAPI', () => ({
  qrcodeAPI: {
    submitEmergencyFeedback: jest.fn(),
  },
}));

describe('EmergencyResponderFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a choice and sends the selected feedback for the scanned tag', async () => {
    (qrcodeAPI.submitEmergencyFeedback as jest.Mock).mockResolvedValue(undefined);
    render(<EmergencyResponderFeedback qrCodeId="tag-1" />);

    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'I found this pet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => {
      expect(qrcodeAPI.submitEmergencyFeedback).toHaveBeenCalledWith('tag-1', 'found', '');
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/feedback was sent/i);
    expect(screen.getByRole('button', { name: 'Report sent' })).toBeDisabled();
  });

  it('sends optional notes with the selected feedback', async () => {
    (qrcodeAPI.submitEmergencyFeedback as jest.Mock).mockResolvedValue(undefined);
    render(<EmergencyResponderFeedback qrCodeId="tag-1" />);

    fireEvent.click(screen.getByRole('radio', { name: 'The pet was treated' }));
    fireEvent.change(screen.getByLabelText(/notes \(optional\)/i), {
      target: { value: '  Treated at the clinic on Main St.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => {
      expect(qrcodeAPI.submitEmergencyFeedback).toHaveBeenCalledWith(
        'tag-1',
        'treated',
        '  Treated at the clinic on Main St.  ',
      );
    });
  });

  it('does not submit until a feedback option is selected', () => {
    render(<EmergencyResponderFeedback qrCodeId="tag-1" />);

    expect(screen.getByRole('radio', { name: 'I found this pet' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'The pet was treated' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'The pet was returned to its owner' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/notes \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    expect(qrcodeAPI.submitEmergencyFeedback).not.toHaveBeenCalled();
  });

  it('shows a denied message when the backend declines the report', async () => {
    (qrcodeAPI.submitEmergencyFeedback as jest.Mock).mockRejectedValue({
      response: { status: 403 },
    });
    render(<EmergencyResponderFeedback qrCodeId="tag-1" />);

    fireEvent.click(screen.getByRole('radio', { name: 'The pet was returned to its owner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /feedback is not available for this emergency profile/i,
    );
  });

  it('shows the backend rate-limit state without losing the selected option', async () => {
    (qrcodeAPI.submitEmergencyFeedback as jest.Mock).mockRejectedValue({
      response: { status: 429 },
    });
    render(<EmergencyResponderFeedback qrCodeId="tag-1" />);

    const safeOption = screen.getByRole('radio', { name: 'I found this pet' });
    fireEvent.click(safeOption);
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/please wait/i);
    expect(safeOption).toBeChecked();
  });
});
