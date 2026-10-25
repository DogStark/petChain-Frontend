import { renderHook, act } from '@testing-library/react';
import { useRecurringPaymentReview } from '../useRecurringPaymentReview';
import { recurringPaymentAPI } from '../lib/api/recurringPaymentAPI';
import type { RecurringPaymentIntent } from '../types/recurringPayment';

jest.mock('../lib/api/recurringPaymentAPI');

const mockedAPI = recurringPaymentAPI as jest.Mocked<typeof recurringPaymentAPI>;

const sampleIntent: RecurringPaymentIntent = {
  id: 'intent-abc',
  sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
  destinationAddress: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQWF5GHGKSXL6TBRDY4KPJVTHZSJ',
  recipientLabel: 'Pet Insurance',
  amount: '40.0000000',
  asset: 'XLM',
  frequency: 'monthly',
  spendingCap: '480.0000000',
  currentSpent: '80.0000000',
  nextExecutionTime: '2026-11-15T09:00:00.000Z',
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  backendAuthorized: true,
  consentDenied: false,
};

describe('useRecurringPaymentReview hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with provided initial intents', () => {
    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        initialIntents: [sampleIntent],
        autoFetch: false,
      })
    );

    expect(result.current.intents).toHaveLength(1);
    expect(result.current.selectedIntent).toEqual(sampleIntent);
    expect(result.current.privacyMask).toBe(false);
  });

  it('toggles privacy mask', () => {
    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        initialIntents: [sampleIntent],
        autoFetch: false,
      })
    );

    act(() => {
      result.current.togglePrivacyMask();
    });

    expect(result.current.privacyMask).toBe(true);

    act(() => {
      result.current.togglePrivacyMask();
    });

    expect(result.current.privacyMask).toBe(false);
  });

  it('fetches intents from API successfully', async () => {
    mockedAPI.getRecurringIntents.mockResolvedValueOnce([sampleIntent]);

    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        autoFetch: false,
      })
    );

    await act(async () => {
      await result.current.fetchIntents();
    });

    expect(mockedAPI.getRecurringIntents).toHaveBeenCalledWith(
      'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW'
    );
    expect(result.current.intents).toEqual([sampleIntent]);
    expect(result.current.selectedIntent).toEqual(sampleIntent);
  });

  it('handles fetch error gracefully', async () => {
    mockedAPI.getRecurringIntents.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        autoFetch: false,
      })
    );

    await act(async () => {
      await result.current.fetchIntents();
    });

    expect(result.current.error).toBe('Network error');
  });

  it('cancels intent via API and updates state locally', async () => {
    mockedAPI.cancelRecurringIntent.mockResolvedValueOnce({
      success: true,
      intentId: 'intent-abc',
      cancelledAt: '2026-10-25T12:00:00.000Z',
      status: 'cancelled',
    });

    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        initialIntents: [sampleIntent],
        autoFetch: false,
      })
    );

    let success = false;
    await act(async () => {
      success = await result.current.cancelIntent('intent-abc', 'User requested');
    });

    expect(success).toBe(true);
    expect(result.current.selectedIntent?.status).toBe('cancelled');
    expect(result.current.selectedIntent?.statusReason).toBe('User requested');
  });

  it('records consent decision via backend API', async () => {
    mockedAPI.recordConsentDecision.mockResolvedValueOnce({
      success: true,
      intent: {
        ...sampleIntent,
        backendAuthorized: false,
        consentDenied: true,
      },
    });

    const { result } = renderHook(() =>
      useRecurringPaymentReview({
        sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
        initialIntents: [sampleIntent],
        autoFetch: false,
      })
    );

    let success = false;
    await act(async () => {
      success = await result.current.recordConsent('intent-abc', 'deny');
    });

    expect(success).toBe(true);
    expect(result.current.selectedIntent?.consentDenied).toBe(true);
  });
});
