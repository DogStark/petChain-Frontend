import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentRequestView } from '@/components/Wallet/PaymentRequestView';
import { usePaymentRequest } from '@/hooks/usePaymentRequest';
import { useWallet } from '@/hooks/useWallet';

jest.mock('@/hooks/usePaymentRequest');
jest.mock('@/hooks/useWallet');
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { req: 'mock-payload' },
  }),
}));

describe('PaymentRequestView Component', () => {
  const validPubKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  const mockResolvePaymentRequest = jest.fn();
  const mockHandlePaymentConsent = jest.fn();
  const mockSendPayment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({
      selectedWallet: { id: 'w1', publicKey: validPubKey, label: 'Main' },
      sendPayment: mockSendPayment,
      loading: false,
    });
  });

  it('renders active payment request details and countdown timer', () => {
    const mockReq = {
      id: 'req_1',
      asset: 'XLM',
      amount: '75.0',
      destination: validPubKey,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      note: 'Emergency clinic treatment',
    };

    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: mockReq,
      timeRemaining: '29m 45s remaining',
      executionResult: null,
      isExpired: false,
      resolvePaymentRequest: mockResolvePaymentRequest,
      handlePaymentConsent: mockHandlePaymentConsent,
    });

    render(<PaymentRequestView initialReqPayload="mock-payload" />);

    expect(screen.getByText('75.0')).toBeInTheDocument();
    expect(screen.getByText(/29m 45s remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/Emergency clinic treatment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve & Pay/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
  });

  it('renders expired state when link has expired', () => {
    const mockReq = {
      id: 'req_expired',
      asset: 'XLM',
      amount: '10.0',
      destination: validPubKey,
      expiresAt: new Date(Date.now() - 5000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'expired' as const,
    };

    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: mockReq,
      timeRemaining: 'Expired',
      executionResult: null,
      isExpired: true,
      resolvePaymentRequest: mockResolvePaymentRequest,
      handlePaymentConsent: mockHandlePaymentConsent,
    });

    render(<PaymentRequestView initialReqPayload="mock-expired" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Payment Request Expired/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve & Pay/i })).not.toBeInTheDocument();
  });

  it('handles user decline click and renders denied state', async () => {
    const mockReq = {
      id: 'req_decline',
      asset: 'XLM',
      amount: '30.0',
      destination: validPubKey,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
    };

    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: mockReq,
      timeRemaining: '25m remaining',
      executionResult: null,
      isExpired: false,
      resolvePaymentRequest: mockResolvePaymentRequest,
      handlePaymentConsent: mockHandlePaymentConsent.mockResolvedValueOnce({
        success: false,
        status: 'denied',
      }),
    });

    render(<PaymentRequestView initialReqPayload="mock-payload" />);

    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(mockHandlePaymentConsent).toHaveBeenCalledWith(validPubKey, false);
      expect(screen.getByText(/Payment Denied/i)).toBeInTheDocument();
    });
  });

  it('opens PIN modal on Approve click and confirms payment submission', async () => {
    const mockReq = {
      id: 'req_approve',
      asset: 'XLM',
      amount: '20.0',
      destination: validPubKey,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
    };

    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: mockReq,
      timeRemaining: '20m remaining',
      executionResult: null,
      isExpired: false,
      resolvePaymentRequest: mockResolvePaymentRequest,
      handlePaymentConsent: mockHandlePaymentConsent.mockResolvedValueOnce({
        success: true,
        status: 'completed',
      }),
    });

    render(<PaymentRequestView initialReqPayload="mock-payload" />);

    fireEvent.click(screen.getByRole('button', { name: /Approve & Pay/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Wallet PIN/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Wallet PIN/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(mockHandlePaymentConsent).toHaveBeenCalledWith(validPubKey, true);
      expect(mockSendPayment).toHaveBeenCalledWith(
        '1234',
        expect.objectContaining({
          amount: '20.0',
          asset: 'XLM',
          destination: validPubKey,
        }),
        expect.any(String)
      );
    });
  });
});
