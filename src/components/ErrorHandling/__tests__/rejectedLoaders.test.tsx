import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import RouteErrorBoundary from '@/components/ErrorHandling/RouteErrorBoundary';
import { petAPI } from '@/lib/api/petAPI';
import {
  clearErrorDiagnostics,
  getErrorDiagnostics,
  containsSensitiveData,
  CORRELATION_HEADER,
} from '@/lib/errorCorrelation';

jest.mock('@/lib/api/petAPI', () => ({
  petAPI: {
    getUserPets: jest.fn(),
  },
}));

// React logs caught render errors; keep test output clean.
let errorSpy: jest.SpyInstance;
beforeAll(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  errorSpy.mockRestore();
});

beforeEach(() => {
  clearErrorDiagnostics();
  (petAPI.getUserPets as jest.Mock).mockReset();
});

// ─── Rejected loaders surface through the boundary ───────────────────────────

describe('rejected data loaders', () => {
  function PetsLoader() {
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      petAPI
        .getUserPets()
        .then(() => undefined)
        .catch((err: unknown) => {
          // A loader that renders its rejection re-throws into the boundary.
          setError(err instanceof Error ? err : new Error('load failed'));
        });
    }, []);

    if (error) throw error;
    return <p>pets loaded</p>;
  }

  it('catches a rejected loader and shows the recovery fallback', async () => {
    (petAPI.getUserPets as jest.Mock).mockRejectedValue(new Error('network down'));

    render(
      <RouteErrorBoundary routeGroup="protected">
        <PetsLoader />
      </RouteErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const buffer = getErrorDiagnostics();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].routeGroup).toBe('protected');
    expect(containsSensitiveData(buffer[0].correlationId)).toBe(false);
  });

  it('recovers when the loader succeeds on retry', async () => {
    (petAPI.getUserPets as jest.Mock)
      .mockRejectedValueOnce(new Error('flaky network'))
      .mockResolvedValueOnce([]);

    render(
      <RouteErrorBoundary routeGroup="protected">
        <PetsLoader />
      </RouteErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('pets loaded')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── API client carries the correlation header ────────────────────────────────

describe('correlation header propagation', () => {
  it('attachesCorrelationInterceptor stamps outgoing requests', async () => {
    // Import after mocks are in place.
    const { attachCorrelationInterceptor } = await import('@/lib/api/correlationInterceptor');

    const headers: Record<string, string> = {};
    const fakeInstance = {
      interceptors: {
        request: {
          use: (fn: (config: { headers: Record<string, string> }) => unknown) => {
            const result = fn({ headers });
            Object.assign(headers, (result as { headers: Record<string, string> }).headers);
          },
        },
      },
    };

    attachCorrelationInterceptor(fakeInstance as never);

    expect(headers[CORRELATION_HEADER]).toMatch(/^ec-server-/);
    expect(containsSensitiveData(headers[CORRELATION_HEADER])).toBe(false);
  });
});
