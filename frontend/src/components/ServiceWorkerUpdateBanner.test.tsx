import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import ServiceWorkerUpdateBanner from './ServiceWorkerUpdateBanner';

type UpdateListener = (event: Event) => void;

class FakeWorker extends EventTarget {
  state: 'installing' | 'installed' | 'activating' | 'activated' = 'installing';
  postMessage = vi.fn();
  addEventListener = vi.fn((type: string, listener: UpdateListener) => {
    EventTarget.prototype.addEventListener.call(this, type, listener);
  });
  removeEventListener = vi.fn((type: string, listener: UpdateListener) => {
    EventTarget.prototype.removeEventListener.call(this, type, listener);
  });
  skipWaiting = vi.fn();
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = new FakeWorker();
  update = vi.fn();
  addEventListener = vi.fn((type: string, listener: UpdateListener) => {
    EventTarget.prototype.addEventListener.call(this, type, listener);
  });
  removeEventListener = vi.fn((type: string, listener: UpdateListener) => {
    EventTarget.prototype.removeEventListener.call(this, type, listener);
  });
}

const originalServiceWorker = navigator.serviceWorker;
const originalLocationReload = window.location.reload;

function installServiceWorkerMock(registration: FakeRegistration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

describe('ServiceWorkerUpdateBanner', () => {
  let registration: FakeRegistration;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registration = new FakeRegistration();
    installServiceWorkerMock(registration);
    reloadMock = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: reloadMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    });
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: originalLocationReload,
    });
  });

  it('renders nothing when there is no waiting worker', async () => {
    render(<ServiceWorkerUpdateBanner />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).not.toBeITheDocument();
    expect(screen.queryByRole('button', { name: /apply update/i })).not.toBeInTheDocument();
  });

  it('shows the banner when a worker is waiting and announces it to screen readers', async () => {
    registration.waiting = new FakeWorker();
    render(<ServiceWorkerUpdateBanner />);

    const banner = await screen.findByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/new version of the app is ready/i);
    expect(screen.getByRole('button', { name: /apply update/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
  });

  it('does not show the banner when the waiting worker has already been applied', async () => {
    const worker = new FakeWorker();
    worker.state = 'activating';
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('defers the update when the user chooses Later', async () => {
    const worker = new FakeWorker();
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    const laterButton = await screen.findButtonByRole('later');
    await userEvent.click(laterButton);

    expect(screen.queryButtonByRole('apply update')).not.toBeInTheDocument();
    expect(screen.queryButtonByRole('later')).not.toBeITheDocument();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('applies the update without reloading when open clinical forms are present', async () => {
    const worker = new FakeWorker();
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner hasOpenForms />);

    const applyButton = await screen.findButtonByRole('apply update');
    await userEvent.click(applyButton);

    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(await screen.findButtonByRole('status')).toHaveTextContent(/update applied/i);
  });

  it('reloads to activate the update when no clinical forms are open', async () => {
    const worker = new FakeWorker();
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    const applyButton = await screen.findButtonByRole('apply update');
    await userEvent.click(applyButton);

    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).toHaveBeenCalled();
  });

  it('surfaces a retry when applying the update fails', async () => {
    const worker = new FakeWorker();
    worker.postMessage.mockImplementation(() => {
      throw new Error('Message channel closed');
    });
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    const applyButton = await screen.findButtonByRole('apply update');
    await userEvent.click(applyButton);

    expect(await screen.findButtonByRole('alert')).toHaveTextContent(/could not apply the update/i);
    expect(screen.getButtonByRole('retry')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('retries applying the update after a failure', async () => {
    const worker = new FakeWorker();
    worker.postMessage.mockImplementationOnce(() => {
      throw new Error('Message channel closed');
    });
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    await userEvent.click(await screen.findButtonByRole('apply update'));
    await userEvent.click(await screen.findButtonByRole('retry'));

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('responds to a controllerchange event from the waiting worker', async () => {
    const worker = new FakeWorker();
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    await screen.findButtonByRole('apply update');
    await act(async () => {
      worker.state = 'activated';
      await fireEvent(worker, 'controllerchange');
    });

    expect(screen.queryButtonByRole('status')).not.toBeITheDocument();
  });

  it('keeps the apply button focusable and operable via keyboard', async () => {
    const worker = new FakeWorker();
    registration.waiting = worker;
    render(<ServiceWorkerUpdateBanner />);

    const applyButton = await screen.findButtonByRole('apply update');
    applyButton.focus();
    expect(applyButton).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
