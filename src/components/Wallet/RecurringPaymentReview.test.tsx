import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecurringPaymentReview from '../RecurringPaymentReview';
import type { RecurringPaymentIntent } from '../../types/recurringPayment';
import { recurringPaymentAPI } from '../../lib/api/recurringPaymentAPI';

jest.mock('../../lib/api/recurringPaymentAPI');

const mockedAPI = recurringPaymentAPI as jest.Mocked<typeof recurringPaymentAPI>;

const mockIntents: RecurringPaymentIntent[] = [
  {
    id: 'intent-1',
    sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
    destinationAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQWF5GHGKSXL6TBRDY4KPJVTHZSJ',
    recipientLabel: 'VetCare Monthly Subscription',
    amount: '25.0000000',
    asset: 'XLM',
    frequency: 'monthly',
    spendingCap: '300.0000000',
    currentSpent: '50.0000000',
    nextExecutionTime: '2026-11-01T10:00:00.000Z',
    status: 'active',
    createdAt: '2026-09-01T10:00:00.000Z',
    memo: 'VetCare-Pet123',
    backendAuthorized: true,
    consentDenied: false,
  },
  {
    id: 'intent-2',
    sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
    destinationAddress: 'GD5GZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
    recipientLabel: 'Pet Food Auto-Delivery',
    amount: '15.5000000',
    asset: 'USDC:GBRPYHIL2CI3WHZDTOOQFC6EB4CGQWF5GHGKSXL6TBRDY4KPJVTHZSJ',
    frequency: 'biweekly',
    spendingCap: '100.0000000',
    currentSpent: '90.0000000',
    nextExecutionTime: '2026-10-30T14:30:00.000Z',
    status: 'paused',
    createdAt: '2026-08-15T12:00:00.000Z',
    backendAuthorized: false,
    consentDenied: true,
    statusReason: 'Cap near threshold or pending user verification',
  },
];

describe('RecurringPaymentReview Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upcoming recurring payment intents with next execution time and spending cap', () => {
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
      />
    );

    expect(screen.getByText('Recurring Stellar Payment Review')).toBeInTheDocument();
    expect(screen.getByText('VetCare Monthly Subscription')).toBeInTheDocument();
    expect(screen.getByText('Pet Food Auto-Delivery')).toBeInTheDocument();

    // Inspect first intent details
    expect(screen.getByText(/25\.0000000 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/Cap: 300\.0000000 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/Spent so far: 50\.0000000 \/ 300\.0000000/)).toBeInTheDocument();
    expect(screen.getByText(/Backend Authorized/)).toBeInTheDocument();
  });

  it('handles empty state when no recurring payment intents are present', () => {
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={[]}
      />
    );

    expect(screen.getByText('No Recurring Payment Intents')).toBeInTheDocument();
    expect(
      screen.getByText(/There are no upcoming recurring Stellar payment schedules configured/i)
    ).toBeInTheDocument();
  });

  it('handles consent-denied or unconsented intent state and blocks transaction signing', async () => {
    const onProceed = jest.fn();
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
        onProceedToSign={onProceed}
      />
    );

    // Switch to intent-2 which is consent-denied
    const deniedOption = screen.getByRole('option', { name: /Pet Food Auto-Delivery/i });
    fireEvent.click(deniedOption);

    expect(screen.getByText('Backend Consent Denied')).toBeInTheDocument();
    expect(
      screen.getByText(/Cap near threshold or pending user verification/i)
    ).toBeInTheDocument();

    const proceedBtn = screen.getByRole('button', { name: /Proceed to sign/i });
    expect(proceedBtn).toBeDisabled();
    fireEvent.click(proceedBtn);
    expect(onProceed).not.toHaveBeenCalled();
  });

  it('allows user to cancel a recurring payment intent before signing', async () => {
    mockedAPI.cancelRecurringIntent.mockResolvedValueOnce({
      success: true,
      intentId: 'intent-1',
      cancelledAt: '2026-10-25T10:00:00.000Z',
      status: 'cancelled',
    });

    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel Recurring Schedule/i });
    fireEvent.click(cancelBtn);

    // Dialog appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const reasonInput = screen.getByLabelText(/Cancellation Reason/i);
    fireEvent.change(reasonInput, { target: { value: 'Switched vet clinics' } });

    const confirmCancelBtn = screen.getByRole('button', { name: /Confirm Cancellation/i });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(mockedAPI.cancelRecurringIntent).toHaveBeenCalledWith('intent-1', 'Switched vet clinics');
    });

    // After cancellation, status displays as cancelled
    await waitFor(() => {
      expect(screen.getByText('Schedule Cancelled')).toBeInTheDocument();
    });
  });

  it('supports privacy masking for sensitive destination addresses and amounts', async () => {
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
      />
    );

    const maskToggle = screen.getByRole('button', { name: /Mask sensitive payment details/i });
    expect(maskToggle).toHaveAttribute('aria-pressed', 'false');

    // Toggle mask ON
    fireEvent.click(maskToggle);
    expect(maskToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Masked')).toBeInTheDocument();
    expect(screen.queryByText('25.0000000 XLM')).not.toBeInTheDocument();
    expect(screen.getByText('•••••• XLM')).toBeInTheDocument();

    // Toggle mask OFF
    fireEvent.click(maskToggle);
    expect(maskToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/25\.0000000 XLM/)).toBeInTheDocument();
  });

  it('allows keyboard navigation across intent list', async () => {
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
      />
    );

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // Select second option with Enter key
    fireEvent.keyDown(options[1], { key: 'Enter', code: 'Enter' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Pet Food Auto-Delivery')).toBeInTheDocument();
  });

  it('allows granting and denying backend consent explicitly', async () => {
    mockedAPI.recordConsentDecision.mockResolvedValueOnce({
      success: true,
      intent: {
        ...mockIntents[1],
        backendAuthorized: true,
        consentDenied: false,
      },
    });

    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
      />
    );

    // Select second (denied) intent
    const options = screen.getAllByRole('option');
    fireEvent.click(options[1]);

    const grantBtn = screen.getByRole('button', { name: /Grant Backend Consent/i });
    fireEvent.click(grantBtn);

    await waitFor(() => {
      expect(mockedAPI.recordConsentDecision).toHaveBeenCalledWith('intent-2', 'grant');
    });
  });

  it('navigates to transaction signing when user approves and clicks Proceed to Sign', async () => {
    const onProceed = jest.fn();
    render(
      <RecurringPaymentReview
        sourcePublicKey="GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW"
        initialIntents={mockIntents}
        onProceedToSign={onProceed}
      />
    );

    const proceedBtn = screen.getByRole('button', { name: /Proceed to sign/i });
    expect(proceedBtn).not.toBeDisabled();
    fireEvent.click(proceedBtn);

    expect(onProceed).toHaveBeenCalledWith(mockIntents[0]);
  });
});
