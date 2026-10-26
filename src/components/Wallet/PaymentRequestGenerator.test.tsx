import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentRequestGenerator } from '@/components/Wallet/PaymentRequestGenerator';
import { usePaymentRequest } from '@/hooks/usePaymentRequest';

jest.mock('@/hooks/usePaymentRequest');

describe('PaymentRequestGenerator Component', () => {
  const validPubKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  const mockCreatePaymentRequest = jest.fn();
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form inputs with correct labels, roles, and accessibility attributes', () => {
    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: null,
      shareableUrl: null,
      timeRemaining: '',
      createPaymentRequest: mockCreatePaymentRequest,
      reset: mockReset,
    });

    render(<PaymentRequestGenerator defaultDestination={validPubKey} />);

    expect(screen.getByRole('heading', { name: /Payment Request Link/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Destination Address/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy protected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Shareable Link/i })).toBeInTheDocument();
  });

  it('allows keyboard navigation across expiry option buttons', () => {
    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: null,
      shareableUrl: null,
      timeRemaining: '',
      createPaymentRequest: mockCreatePaymentRequest,
      reset: mockReset,
    });

    render(<PaymentRequestGenerator defaultDestination={validPubKey} />);

    const oneHourBtn = screen.getByRole('button', { name: /1 Hour/i });
    const oneDayBtn = screen.getByRole('button', { name: /24 Hours/i });

    expect(oneHourBtn).toHaveAttribute('aria-pressed', 'true');
    expect(oneDayBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(oneDayBtn);
    expect(oneDayBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('submits valid request values to createPaymentRequest', async () => {
    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: null,
      shareableUrl: null,
      timeRemaining: '',
      createPaymentRequest: mockCreatePaymentRequest,
      reset: mockReset,
    });

    render(<PaymentRequestGenerator defaultDestination={validPubKey} />);

    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '45.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Shareable Link/i }));

    await waitFor(() => {
      expect(mockCreatePaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: 'XLM',
          amount: '45.5',
          destination: validPubKey,
          expiresInMinutes: 60,
        })
      );
    });
  });

  it('displays error message with role="alert" when an error occurs', () => {
    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: 'Destination address cannot be a secret key.',
      activeRequest: null,
      shareableUrl: null,
      timeRemaining: '',
      createPaymentRequest: mockCreatePaymentRequest,
      reset: mockReset,
    });

    render(<PaymentRequestGenerator defaultDestination="" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/cannot be a secret key/i);
  });

  it('renders created shareable link and copy action once activeRequest is created', async () => {
    const mockReq = {
      id: 'req_created',
      asset: 'XLM',
      amount: '50',
      destination: validPubKey,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
    };

    (usePaymentRequest as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      activeRequest: mockReq,
      shareableUrl: 'https://petchain.app/pay/request?req=xyz123',
      timeRemaining: '59m 50s remaining',
      createPaymentRequest: mockCreatePaymentRequest,
      reset: mockReset,
    });

    render(<PaymentRequestGenerator defaultDestination={validPubKey} />);

    expect(screen.getByText(/Payment Request Ready to Share/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://petchain.app/pay/request?req=xyz123')).toBeInTheDocument();
    expect(screen.getByText(/59m 50s remaining/i)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Copy payment link/i });
    expect(copyBtn).toBeInTheDocument();
  });
});
