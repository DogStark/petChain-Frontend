/**
 * Tests for WalletBackup component – secure clipboard handling.
 *
 * Characterisation tests (Task 4) are marked with [CHARACTERISE].
 * They document the *current* insecure behaviour so that any regression is
 * immediately visible. Specification tests document the *required* behaviour
 * after the fix.
 *
 * Fixture data uses stub values – never real wallet keys or credentials.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import WalletBackup from './WalletBackup';
import type { WalletAccount, BackupData } from '../../types/wallet';
import * as clipboardUtils from '../../utils/clipboard';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const STUB_PUBLIC_KEY =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function makeWallet(overrides: Partial<WalletAccount> = {}): WalletAccount {
  return {
    id: 'wallet-test-001',
    publicKey: STUB_PUBLIC_KEY,
    label: 'Test Wallet',
    type: 'standard',
    network: 'TESTNET',
    encryptedSecretKey: 'enc-stub',
    iv: 'iv-stub',
    salt: 'salt-stub',
    createdAt: '2024-01-01T00:00:00Z',
    backupVerified: false,
    ...overrides,
  };
}

function makeBackupData(wallet: WalletAccount): BackupData {
  return {
    version: 1,
    publicKey: wallet.publicKey,
    encryptedKey: 'encrypted-stub',
    iv: 'iv-stub',
    salt: 'salt-stub',
    checksum: 'checksum-stub',
    label: wallet.label,
    network: wallet.network,
    createdAt: wallet.createdAt,
  };
}

// ── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  // Mock navigator.clipboard — avoid real async clipboard API in jsdom
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
    writable: true,
    configurable: true,
  });

  // Spy on the clipboard utility so tests don't need real timers
  jest.spyOn(clipboardUtils, 'copyWithTTL').mockResolvedValue({ ok: true });
  jest.spyOn(clipboardUtils, 'clearClipboardNow').mockResolvedValue(undefined);

  // Mock URL/blob utilities used by the export flow
  global.URL.createObjectURL = jest.fn().mockReturnValue('blob:stub');
  global.URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Null / empty state ───────────────────────────────────────────────────────

describe('WalletBackup – null wallet', () => {
  it('shows a placeholder message when no wallet is selected', () => {
    render(
      <WalletBackup wallet={null} onExportBackup={jest.fn()} />
    );
    expect(screen.getByText(/select a wallet/i)).toBeInTheDocument();
  });
});

// ── [CHARACTERISE] Public key visibility – pre-fix baseline ─────────────────
// These tests document the *existing* behaviour. They pass before and after the fix
// because they record what the component currently does (expose the public key).

describe('WalletBackup – public key display (characterisation)', () => {
  it('[CHARACTERISE] public key is rendered in plain text', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    // The public key IS already shown — this is not secret, but we document it.
    expect(screen.getByText(STUB_PUBLIC_KEY)).toBeInTheDocument();
  });
});

// ── Security: no automatic clipboard write ───────────────────────────────────

describe('WalletBackup – clipboard security', () => {
  it('does NOT write to clipboard automatically on render', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('does NOT write to clipboard automatically when export succeeds', async () => {
    const wallet = makeWallet();
    const backup = makeBackupData(wallet);
    const onExport = jest.fn().mockResolvedValue(backup);

    render(<WalletBackup wallet={wallet} onExportBackup={onExport} />);

    await userEvent.type(
      screen.getByPlaceholderText(/your wallet pin/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /export encrypted backup/i })
    );

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith('1234');
    });

    // copyWithTTL must NOT have been called for the export action
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();
    // Direct clipboard writes also must not happen
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows a clipboard security warning', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    // A security note about clipboard history should be visible
    expect(
      screen.getAllByText(/clipboard/i).length
    ).toBeGreaterThan(0);
  });

  it('has an explicit "Copy public key" button', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /copy public key/i })
    ).toBeInTheDocument();
  });

  it('copies public key only after explicit button click, not before', async () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    // Not copied yet
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: /copy public key/i })
    );

    expect(clipboardUtils.copyWithTTL).toHaveBeenCalledWith(
      STUB_PUBLIC_KEY,
      expect.any(Number)
    );
  });

  it('shows "Copied!" feedback after copy button is clicked', async () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );

    await userEvent.click(
      screen.getByRole('button', { name: /copy public key/i })
    );

    await waitFor(() => {
      // Use role="status" to avoid matching the security notice text "copied"
      expect(screen.getByRole('status')).toHaveTextContent(/copied/i);
    });
  });

  it('shows an error message when clipboard write fails', async () => {
    (clipboardUtils.copyWithTTL as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'Permission denied',
    });

    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );

    await userEvent.click(
      screen.getByRole('button', { name: /copy public key/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('WalletBackup – accessibility', () => {
  it('PIN toggle button has an accessible label', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    // The show/hide PIN button should have an aria-label
    const toggleBtn = screen.getByRole('button', { name: /show pin|hide pin/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('copy button is keyboard-focusable (no tabindex=-1)', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    const copyBtn = screen.getByRole('button', { name: /copy public key/i });
    // Buttons are natively focusable; verify tabIndex is not -1
    expect(copyBtn).not.toHaveAttribute('tabindex', '-1');
  });

  it('export button is disabled until PIN is entered', () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /export encrypted backup/i })
    ).toBeDisabled();
  });

  it('export button becomes enabled after PIN is typed', async () => {
    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={jest.fn()} />
    );
    await userEvent.type(
      screen.getByPlaceholderText(/your wallet pin/i),
      '1234'
    );
    expect(
      screen.getByRole('button', { name: /export encrypted backup/i })
    ).toBeEnabled();
  });
});

// ── Export success / failure ──────────────────────────────────────────────────

describe('WalletBackup – export flow', () => {
  it('shows success banner after a successful export', async () => {
    const wallet = makeWallet();
    const backup = makeBackupData(wallet);
    const onExport = jest.fn().mockResolvedValue(backup);

    render(<WalletBackup wallet={wallet} onExportBackup={onExport} />);

    await userEvent.type(
      screen.getByPlaceholderText(/your wallet pin/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /export encrypted backup/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/backup downloaded/i)).toBeInTheDocument();
    });
  });

  it('shows an error banner when export fails with wrong PIN', async () => {
    const onExport = jest
      .fn()
      .mockRejectedValue(new Error('decrypt operation failed'));

    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={onExport} />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/your wallet pin/i),
      'wrong'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /export encrypted backup/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during export', async () => {
    let resolveExport!: (v: BackupData) => void;
    const onExport = jest.fn(
      () =>
        new Promise<BackupData>((res) => {
          resolveExport = res;
        })
    );

    render(
      <WalletBackup wallet={makeWallet()} onExportBackup={onExport} />
    );

    await userEvent.type(
      screen.getByPlaceholderText(/your wallet pin/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /export encrypted backup/i })
    );

    expect(screen.getByText(/exporting/i)).toBeInTheDocument();

    const wallet = makeWallet();
    await act(async () => {
      resolveExport(makeBackupData(wallet));
    });
  });
});
