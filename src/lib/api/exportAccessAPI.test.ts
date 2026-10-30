jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, create: jest.fn() };
});

import axios from 'axios';

import type * as ExportAccessModule from '@/lib/api/exportAccessAPI';

const mockGet = jest.fn();
const mockUse = jest.fn();

// The API singleton is created at import time, so configure the axios mock
// before requiring the module under test.
(axios.create as jest.Mock).mockReturnValue({
  get: mockGet,
  interceptors: { request: { use: mockUse } },
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { exportAccessAPI, PersonalDataAccessError } =
  require('@/lib/api/exportAccessAPI') as typeof ExportAccessModule;
/* eslint-enable @typescript-eslint/no-require-imports */

describe('exportAccessAPI', () => {
  beforeEach(() => {
    mockGet.mockReset();
    localStorage.clear();
  });

  it('resolves the backend decision for a requested date range', async () => {
    mockGet.mockResolvedValue({
      data: { allowed: true, reason: 'consent_granted', scope: { startDate: '2026-10-24' } },
    });

    const decision = await exportAccessAPI.requestPersonalDataAccess({
      startDate: '2026-10-24',
      endDate: '2026-10-26',
    });

    expect(mockGet).toHaveBeenCalledWith('/personal-data-access', {
      params: { startDate: '2026-10-24', endDate: '2026-10-26' },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('consent_granted');
  });

  it('normalises a denial returned with a 200 response', async () => {
    mockGet.mockResolvedValue({ data: { allowed: false, reason: 'consent_not_granted' } });

    const decision = await exportAccessAPI.requestPersonalDataAccess();

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('consent_not_granted');
    expect(mockGet).toHaveBeenCalledWith('/personal-data-access', { params: {} });
  });

  it('rejects with status and message when the backend denies with 403', async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 403',
      response: {
        status: 403,
        data: { message: 'Consent is missing for this account', reason: 'consent_not_granted' },
      },
    });

    await expect(exportAccessAPI.requestPersonalDataAccess()).rejects.toMatchObject({
      name: 'PersonalDataAccessError',
      status: 403,
      reason: 'consent_not_granted',
      message: 'Consent is missing for this account',
    });
    await expect(exportAccessAPI.requestPersonalDataAccess()).rejects.toBeInstanceOf(
      PersonalDataAccessError,
    );
  });

  it('rejects with 401 for an expired session', async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401, data: { message: 'Sign in again' } },
    });

    await expect(exportAccessAPI.requestPersonalDataAccess()).rejects.toMatchObject({
      status: 401,
      message: 'Sign in again',
    });
  });

  it('rejects without a status for transport failures', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));

    await expect(exportAccessAPI.requestPersonalDataAccess()).rejects.toMatchObject({
      status: undefined,
      message: 'Network Error',
    });
  });

  it('attaches the stored bearer token to outgoing requests', async () => {
    localStorage.setItem('authToken', 'token-123');
    const interceptor = mockUse.mock.calls[0][0] as (config: {
      headers: Record<string, string>;
    }) => { headers: Record<string, string> };

    const result = interceptor({ headers: {} });

    expect(result.headers.Authorization).toBe('Bearer token-123');
  });
});
