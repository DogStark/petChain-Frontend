import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock heavy dependencies
vi.mock('./utils/wallet-bridge', () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: false }),
  requestAccess: vi.fn().mockResolvedValue({ address: null, error: 'Not connected' }),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: '' }),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  Horizon: { Server: vi.fn() },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  TransactionBuilder: vi.fn(),
  Operation: { payment: vi.fn() },
  Asset: { native: vi.fn() },
  BASE_FEE: '100',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'en', dir: () => 'ltr' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./utils/network-config', () => ({
  getCurrentNetworkConfig: vi.fn().mockReturnValue({
    networkPassphrase: 'Test SDF Network ; September 2015',
    contractId: 'CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  }),
}));

vi.mock('./utils/accessibility', () => ({
  announceToScreenReader: vi.fn(),
  generateId: vi.fn((prefix: string) => `${prefix}-test`),
  setupKeyboardNavigation: vi.fn(),
  setupFocusVisible: vi.fn(),
}));

vi.mock('./services/schedulingService', () => ({
  SchedulingService: { getInstance: vi.fn().mockReturnValue({}) },
}));

vi.mock('./services/notificationService', () => ({
  NotificationService: { getInstance: vi.fn().mockReturnValue({}) },
}));

vi.mock('./hooks/useWalletBalance', () => ({
  useWalletBalance: vi.fn().mockReturnValue({
    balance: null,
    isSufficientBalance: vi.fn().mockReturnValue(true),
    refreshBalance: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('./hooks/useFeeEstimation', () => ({
  useFeeEstimation: vi.fn().mockReturnValue({
    estimate: null,
    estimateFee: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('./utils/offlineApi', () => ({
  handleOfflineError: vi.fn(),
  getOfflineErrorMessage: vi.fn().mockReturnValue('Offline'),
}));

vi.mock('./hooks/useConnectivity', () => ({
  useConnectivity: vi.fn().mockReturnValue({ isOnline: true }),
}));

// Mock child components to isolate App rendering
vi.mock('./components/ResponsiveNavigation', () => ({
  ResponsiveNavigation: () => <nav data-testid="navigation" />,
}));

vi.mock('./components/SkipLinks', () => ({
  SkipLinks: () => <div data-testid="skip-links" />,
}));

vi.mock('./components/OfflineBanner', () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}));

vi.mock('./components/OfflineStatusIndicator', () => ({
  OfflineStatusIndicator: () => <div data-testid="offline-status" />,
}));

vi.mock('./components/OfflineErrorBoundary', () => ({
  OfflineErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

vi.mock('./components/WalletBalance', () => ({
  WalletBalance: () => <div data-testid="wallet-balance" />,
}));

vi.mock('./pages/About', () => ({ default: () => <div data-testid="about-page" /> }));
vi.mock('./pages/Contact', () => ({ default: () => <div data-testid="contact-page" /> }));
vi.mock('./pages/Rate', () => ({ default: () => <div data-testid="rate-page" /> }));
vi.mock('./pages/ScheduledPayments', () => ({
  default: () => <div data-testid="scheduled-payments-page" />,
}));

import App from './App';

describe('App component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });

  it('renders navigation', () => {
    render(<App />);
    expect(screen.getByTestId('navigation')).toBeDefined();
  });

  it('renders skip links for accessibility', () => {
    render(<App />);
    expect(screen.getByTestId('skip-links')).toBeDefined();
  });

  it('renders error boundary wrapper', () => {
    render(<App />);
    expect(screen.getByTestId('error-boundary')).toBeDefined();
  });

  it('renders offline banner', () => {
    render(<App />);
    expect(screen.getByTestId('offline-banner')).toBeDefined();
  });
});

describe('App routing', () => {
  it('renders home route by default', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });

  it('renders about page on /about route', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('about-page')).toBeDefined();
  });

  it('renders contact page on /contact route', () => {
    render(
      <MemoryRouter initialEntries={['/contact']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('contact-page')).toBeDefined();
  });

  it('renders scheduled payments page on /scheduled-payments route', () => {
    render(
      <MemoryRouter initialEntries={['/scheduled-payments']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('scheduled-payments-page')).toBeDefined();
  });
});

describe('App context providers', () => {
  it('provides wallet balance context', () => {
    render(<App />);
    expect(screen.getByTestId('wallet-balance')).toBeDefined();
  });
});
