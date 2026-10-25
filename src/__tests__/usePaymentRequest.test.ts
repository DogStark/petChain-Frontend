import { renderHook, act } from '@testing-library/react';
import { usePaymentRequest } from '@/hooks/usePaymentRequest';
import { paymentRequestAPI } from '@/lib/api/paymentRequestAPI';

jest.mock('@/lib/api/paymentRequestAPI');

describe('usePaymentRequest Hook', () => {
  const validPubKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  const secretKey = 'SB2Y7WJWW3XUOBW5I2C365R4R7E436H5763V7D737P57G7Q66M35Y6Z7';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default empty state', () => {
    const { result } = renderHook(() => usePaymentRequest());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.activeRequest).toBeNull();
    expect(result.current.shareableUrl).toBeNull();
    expect(result.current.isExpired).toBe(false);
  });

  describe('createPaymentRequest', () => {
    it('successfully creates payment request and shareable url', async () => {
      const mockReq = {
        id: 'req_100',
        asset: 'XLM',
        amount: '25.0',
        destination: validPubKey,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.createRequest as jest.Mock).mockResolvedValueOnce(mockReq);

      const { result } = renderHook(() => usePaymentRequest());

      let created;
      await act(async () => {
        created = await result.current.createPaymentRequest({
          asset: 'XLM',
          amount: '25.0',
          destination: validPubKey,
          expiresInMinutes: 60,
        });
      });

      expect(created).toEqual(mockReq);
      expect(result.current.activeRequest).toEqual(mockReq);
      expect(result.current.shareableUrl).toContain('/pay/request?req=');
      expect(result.current.error).toBeNull();
    });

    it('rejects destination if it is a secret key (preventing wallet secrets leak)', async () => {
      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const res = await result.current.createPaymentRequest({
          asset: 'XLM',
          amount: '10',
          destination: secretKey,
          expiresInMinutes: 30,
        });
        expect(res).toBeNull();
      });

      expect(result.current.error).toMatch(/never a secret key/i);
      expect(paymentRequestAPI.createRequest).not.toHaveBeenCalled();
    });

    it('rejects invalid payment amounts', async () => {
      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const res = await result.current.createPaymentRequest({
          asset: 'XLM',
          amount: '-5.0',
          destination: validPubKey,
          expiresInMinutes: 30,
        });
        expect(res).toBeNull();
      });

      expect(result.current.error).toMatch(/valid payment amount/i);
    });

    it('rejects invalid or missing expiration', async () => {
      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const res = await result.current.createPaymentRequest({
          asset: 'XLM',
          amount: '10',
          destination: validPubKey,
          expiresInMinutes: 0,
        });
        expect(res).toBeNull();
      });

      expect(result.current.error).toMatch(/valid expiration duration/i);
    });
  });

  describe('resolvePaymentRequest', () => {
    it('resolves valid payment request by payload or ID', async () => {
      const mockReq = {
        id: 'req_resolved',
        asset: 'USDC',
        amount: '100',
        destination: validPubKey,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.resolveRequest as jest.Mock).mockResolvedValueOnce(mockReq);

      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const resolved = await result.current.resolvePaymentRequest('req_resolved');
        expect(resolved).toEqual(mockReq);
      });

      expect(result.current.activeRequest).toEqual(mockReq);
    });

    it('sets error when link resolution fails or is empty', async () => {
      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const resolved = await result.current.resolvePaymentRequest('');
        expect(resolved).toBeNull();
      });

      expect(result.current.error).toMatch(/No payment request identifier/i);
    });

    it('rejects resolved request containing secret key as destination', async () => {
      const mockUnsafeReq = {
        id: 'req_unsafe',
        asset: 'XLM',
        amount: '10',
        destination: secretKey,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.resolveRequest as jest.Mock).mockResolvedValueOnce(mockUnsafeReq);

      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        const resolved = await result.current.resolvePaymentRequest('req_unsafe');
        expect(resolved).toBeNull();
      });

      expect(result.current.error).toMatch(/unsafe destination address/i);
    });
  });

  describe('handlePaymentConsent (Authorization and Consent Decisions)', () => {
    it('handles denied state when user rejects consent', async () => {
      const mockReq = {
        id: 'req_deny',
        asset: 'XLM',
        amount: '50',
        destination: validPubKey,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.resolveRequest as jest.Mock).mockResolvedValueOnce(mockReq);
      (paymentRequestAPI.executePayment as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 'denied',
        error: 'Payment was denied by user consent.',
      });

      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        await result.current.resolvePaymentRequest('req_deny');
      });

      let consentRes;
      await act(async () => {
        consentRes = await result.current.handlePaymentConsent(validPubKey, false);
      });

      expect(consentRes).toEqual({
        success: false,
        status: 'denied',
        error: 'Payment was denied by user consent.',
      });
      expect(result.current.executionResult?.status).toBe('denied');
    });

    it('approves consent and executes payment when approved', async () => {
      const mockReq = {
        id: 'req_approve',
        asset: 'XLM',
        amount: '50',
        destination: validPubKey,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.resolveRequest as jest.Mock).mockResolvedValueOnce(mockReq);
      (paymentRequestAPI.executePayment as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'completed',
        transactionHash: '0xabc123',
      });

      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        await result.current.resolvePaymentRequest('req_approve');
      });

      let consentRes;
      await act(async () => {
        consentRes = await result.current.handlePaymentConsent(validPubKey, true);
      });

      expect(consentRes).toEqual({
        success: true,
        status: 'completed',
        transactionHash: '0xabc123',
      });
      expect(result.current.activeRequest?.status).toBe('completed');
    });

    it('rejects payment authorization if link has expired', async () => {
      const mockExpiredReq = {
        id: 'req_exp',
        asset: 'XLM',
        amount: '50',
        destination: validPubKey,
        expiresAt: new Date(Date.now() - 5000).toISOString(), // expired
        createdAt: new Date(Date.now() - 100000).toISOString(),
        status: 'active' as const,
      };

      (paymentRequestAPI.resolveRequest as jest.Mock).mockResolvedValueOnce(mockExpiredReq);

      const { result } = renderHook(() => usePaymentRequest());

      await act(async () => {
        await result.current.resolvePaymentRequest('req_exp');
      });

      let consentRes;
      await act(async () => {
        consentRes = await result.current.handlePaymentConsent(validPubKey, true);
      });

      expect(consentRes).toEqual({
        success: false,
        status: 'expired',
        error: 'This payment request link has expired.',
      });
      expect(paymentRequestAPI.executePayment).not.toHaveBeenCalled();
    });
  });
});
