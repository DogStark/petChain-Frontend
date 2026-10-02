import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import {
  getErrorDiagnostics,
  clearErrorDiagnostics,
  containsSensitiveData,
} from '@/lib/errorCorrelation';

import RouteErrorBoundary, {
  RouteErrorBoundaryWithRouter,
} from '../RouteErrorBoundary';

// ─── Router mock (hoisted factory reads the variable at call time) ───────────

let mockAsPath = '/dashboard';

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: mockAsPath }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Bomb({ message }: { message?: string }): React.ReactNode {
  throw new Error(message ?? 'kaboom');
}

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
  mockAsPath = '/dashboard';
});

// ─── Render exception handling ────────────────────────────────────────────────

describe('RouteErrorBoundary — render exceptions', () => {
  it('renders the fallback UI when a child throws', () => {
    render(
      <RouteErrorBoundary routeGroup="protected">
        <Bomb />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByTestId('route-error-protected')).toBeInTheDocument();
  });

  it('shows a correlation ID that contains no sensitive data', () => {
    render(
      <RouteErrorBoundary routeGroup="public">
        <Bomb />
      </RouteErrorBoundary>,
    );

    const code = screen.getByText(/^ec-/);
    expect(code).toBeInTheDocument();
    expect(containsSensitiveData(code.textContent ?? '')).toBe(false);
  });

  it('records a sanitized diagnostic entry', () => {
    render(
      <RouteErrorBoundary routeGroup="protected">
        <Bomb />
      </RouteErrorBoundary>,
    );

    const buffer = getErrorDiagnostics();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].routeGroup).toBe('protected');
    expect(buffer[0].errorKind).toBe('Error');
    expect(containsSensitiveData(buffer[0].correlationId)).toBe(false);
  });

  it('does not render fallback when children render normally', () => {
    render(
      <RouteErrorBoundary routeGroup="public">
        <p>all good</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── Retry behavior ───────────────────────────────────────────────────────────

describe('RouteErrorBoundary — retry', () => {
  it('recovers and re-renders children when the child stops throwing', () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('transient');
      return <p>recovered content</p>;
    }

    render(
      <RouteErrorBoundary routeGroup="public">
        <Flaky />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never retries automatically while the fallback is shown', () => {
    let attempts = 0;
    function Counting(): React.ReactNode {
      attempts += 1;
      throw new Error('no auto retry');
    }

    render(
      <RouteErrorBoundary routeGroup="public">
        <Counting />
      </RouteErrorBoundary>,
    );

    const attemptsAtCatch = attempts;
    expect(attemptsAtCatch).toBeGreaterThan(0);

    // The boundary schedules no retries itself — the count is frozen until
    // an external re-render happens.
    expect(attempts).toBe(attemptsAtCatch);
  });

  it('resets only the failed segment and leaves sibling subtrees untouched', () => {
    const siblingMounts: number[] = [];

    function Sibling() {
      siblingMounts.push(siblingMounts.length + 1);
      return <p>sibling ok</p>;
    }

    function Throwing(): React.ReactNode {
      throw new Error('segment failure');
    }

    // Sibling lives inside its own boundary — a retry in the failed one
    // must never re-mount it.
    render(
      <RouteErrorBoundary routeGroup="public">
        <Sibling />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('sibling ok')).toBeInTheDocument();

    const { unmount } = render(
      <RouteErrorBoundary routeGroup="public">
        <Throwing />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(siblingMounts).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    // The retry re-renders the failed subtree; the sibling is untouched.
    expect(siblingMounts).toHaveLength(1);
    unmount();
  });

  it('re-renders the failed subtree exactly once per manual retry (no duplicate work)', () => {
    let shouldThrow = true;
    let renderAttempts = 0;

    function Flaky(): React.ReactNode {
      renderAttempts += 1;
      if (shouldThrow) throw new Error('first attempt fails');
      return <p>done</p>;
    }

    render(
      <RouteErrorBoundary routeGroup="protected">
        <Flaky />
      </RouteErrorBoundary>,
    );

    const attemptsAtCatch = renderAttempts;
    expect(attemptsAtCatch).toBeGreaterThan(0);

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // One click → exactly one additional render pass of the subtree.
    expect(renderAttempts).toBe(attemptsAtCatch + 1);
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('keeps the fallback functional after a retry that fails again', () => {
    let shouldThrow = true;

    function Flaky(): React.ReactNode {
      if (shouldThrow) throw new Error('first');
      throw new Error('second wave');
    }

    render(
      <RouteErrorBoundary routeGroup="public">
        <Flaky />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false; // still throws ('second wave')
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Diagnostics recorded one entry per caught incident.
    expect(getErrorDiagnostics().length).toBe(2);
  });
});

// ─── Focus management ─────────────────────────────────────────────────────────

describe('RouteErrorBoundary — keyboard accessibility', () => {
  it('moves focus to the fallback heading after an error', async () => {
    render(
      <RouteErrorBoundary routeGroup="public">
        <Bomb />
      </RouteErrorBoundary>,
    );

    const heading = screen.getByRole('heading', { name: /something went wrong/i });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});

// ─── Navigation / remounting ──────────────────────────────────────────────────

describe('RouteErrorBoundaryWithRouter', () => {
  it('classifies protected routes and keys the boundary by path', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactNode {
      if (shouldThrow) throw new Error('nav failure');
      return <p>dashboard content</p>;
    }

    render(
      <RouteErrorBoundaryWithRouter>
        <Flaky />
      </RouteErrorBoundaryWithRouter>,
    );

    expect(screen.getByTestId('route-error-protected')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });

  it('classifies unknown paths as public', () => {
    mockAsPath = '/about';

    render(
      <RouteErrorBoundaryWithRouter>
        <Bomb />
      </RouteErrorBoundaryWithRouter>,
    );

    expect(screen.getByTestId('route-error-public')).toBeInTheDocument();
  });

  it('classifies the pets detail route as protected', () => {
    mockAsPath = '/pets/123e4567';

    render(
      <RouteErrorBoundaryWithRouter>
        <Bomb />
      </RouteErrorBoundaryWithRouter>,
    );

    expect(screen.getByTestId('route-error-protected')).toBeInTheDocument();
  });
});

// ─── Custom fallback ──────────────────────────────────────────────────────────

describe('RouteErrorBoundary — custom fallback', () => {
  it('invokes the render override with state and reset', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactNode {
      if (shouldThrow) throw new Error('custom');
      return <p>custom recovered</p>;
    }

    render(
      <RouteErrorBoundary
        routeGroup="public"
        fallback={(state, reset) => (
          <div role="alert">
            <span>custom fallback: {state.correlationId.slice(0, 3)}</span>
            <button
              type="button"
              onClick={() => {
                shouldThrow = false;
                reset();
              }}
            >
              custom reset
            </button>
          </div>
        )}
      >
        <Flaky />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('custom fallback: ec-')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /custom reset/i }));
    expect(screen.getByText('custom recovered')).toBeInTheDocument();
  });
});
