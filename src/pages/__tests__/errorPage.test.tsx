import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ErrorPage from '../_error';
import { containsSensitiveData, clearErrorDiagnostics } from '@/lib/errorCorrelation';

jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  clearErrorDiagnostics();
});

function renderWithProps(props: {
  statusCode: number;
  correlationId: string;
  routeGroup: 'public' | 'protected' | 'server';
  currentPath?: string;
}) {
  return render(<ErrorPage currentPath="/" {...props} />);
}

describe('_error page', () => {
  it('renders 404 content with a homepage link', () => {
    renderWithProps({ statusCode: 404, correlationId: 'ec-public-ok-abc123def456', routeGroup: 'public' });

    expect(screen.getByTestId('error-page-404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByText(/does not exist or has moved/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/');
  });

  it('renders 500 content with a recovery link', () => {
    renderWithProps({ statusCode: 500, correlationId: 'ec-protected-ok-abc123def456', routeGroup: 'protected' });

    expect(screen.getByTestId('error-page-500')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to safety/i })).toHaveAttribute('href', '/');
  });

  it('displays a correlation ID free of sensitive data', () => {
    renderWithProps({ statusCode: 500, correlationId: 'ec-server-ok-abc123def456', routeGroup: 'server' });

    const code = screen.getByText(/^ec-/);
    expect(code).toBeInTheDocument();
    expect(containsSensitiveData(code.textContent ?? '')).toBe(false);
  });

  it('marks the page noindex so error pages stay out of search results', () => {
    renderWithProps({ statusCode: 404, correlationId: 'ec-public-ok-abc123def456', routeGroup: 'public' });

    const meta = document.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('noindex');
  });

  describe('getInitialProps', () => {
    it('derives 404 from res.statusCode and a path-only reload link', () => {
      const props = ErrorPage.getInitialProps({
        res: { statusCode: 404 },
        err: undefined,
        req: { url: '/some/missing/page?next=/x#frag', headers: {} },
      } as never);

      expect(props.statusCode).toBe(404);
      expect(props.correlationId).toMatch(/^ec-public-/);
      expect(props.routeGroup).toBe('public');
      // Query/hash stripped: the no-JS reload link is a plain path.
      expect(props.currentPath).toBe('/some/missing/page');
    });

    it('derives 500 from err.statusCode when res is absent (client navigation)', () => {
      const props = ErrorPage.getInitialProps({
        res: undefined,
        err: { statusCode: 500 },
        req: undefined,
      } as never);

      expect(props.statusCode).toBe(500);
      expect(props.routeGroup).toBe('public');
    });

    it('classifies protected URLs and honors a clean upstream correlation header', () => {
      const props = ErrorPage.getInitialProps({
        res: { statusCode: 500 },
        err: undefined,
        req: { url: '/dashboard', headers: { 'x-correlation-id': 'ec-protected-ok-abc123def456' } },
      } as never);

      expect(props.routeGroup).toBe('protected');
      expect(props.correlationId).toBe('ec-protected-ok-abc123def456');
    });

    it('discards a tainted upstream correlation header and generates a safe one', () => {
      const props = ErrorPage.getInitialProps({
        res: { statusCode: 500 },
        err: undefined,
        req: {
          url: '/dashboard',
          headers: { 'x-correlation-id': 'pet-vaccination-wallet-leak' },
        },
      } as never);

      expect(props.correlationId).not.toBe('pet-vaccination-wallet-leak');
      expect(props.correlationId).toMatch(/^ec-protected-/);
      expect(containsSensitiveData(props.correlationId)).toBe(false);
    });
  });
});
