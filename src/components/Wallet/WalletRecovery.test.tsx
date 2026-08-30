/**
 * Tests for WalletRecovery component – secure clipboard handling.
 *
 * Characterisation tests (Task 4) are marked with [CHARACTERISE].
 * They document *existing* behaviour before the fix. Specification tests
 * document the *required* behaviour after the fix.
 *
 * Fixture data uses stub values – never real wallet keys or credentials.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import WalletRecovery from './WalletRecovery';
import type { WalletAccount, BackupData } from '../../types/wallet';
import * as clipboardUtils from '../../utils/clipboard';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const STUB_PUBLIC_KEY =
  'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function makeRecoveredWallet(
  overrides: Partial<WalletAccount> = {}
): WalletAccount {
  return {
    id: 'wallet-recovered-001',
    publicKey: STUB_PUBLIC_KEY,
    label: 'Recovered Wallet',
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

function makeBackupFile(wallet: WalletAccount): BackupData {
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

/** Creates a real File object that looks like a backup JSON file. */
function makeBackupFileObject(wallet: WalletAccount): File {
  const backup = makeBackupFile(wallet);
  return new File([JSON.stringify(backup)], 'petchain-backup.json', {
    type: 'application/json',
  });
}

// ── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
    writable: true,
    configurable: true,
  });

  // Spy on clipboard utility so tests don't require real timers
  jest.spyOn(clipboardUtils, 'copyWithTTL').mockResolvedValue({ ok: true });
  jest.spyOn(clipboardUtils, 'clearClipboardNow').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Helper: render + upload a valid backup file ───────────────────────────────

async function renderAndUploadBackup(
  wallet: WalletAccount,
  onImport: jest.Mock
) {
  const utils = render(
    <WalletRecovery
      onImportBackup={onImport}
      loading={false}
      error={null}
      onClearError={jest.fn()}
    />
  );

  // The file input is hidden; find it via the DOM
  const fileInput = utils.container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  expect(fileInput).not.toBeNull();

  await act(async () => {
    await userEvent.upload(fileInput, makeBackupFileObject(wallet));
  });

  return utils;
}

// ── Idle state ────────────────────────────────────────────────────────────────

describe('WalletRecovery – idle state', () => {
  it('renders the recovery form with a file upload area', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error={null}
        onClearError={jest.fn()}
      />
    );
    expect(
      screen.getByText(/click to select backup file/i)
    ).toBeInTheDocument();
  });

  it('does NOT write to clipboard on render', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error={null}
        onClearError={jest.fn()}
      />
    );
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});

// ── [CHARACTERISE] Recovered wallet display ──────────────────────────────────

describe('WalletRecovery – post-recovery display (characterisation)', () => {
  it('[CHARACTERISE] shows recovered wallet public key after successful recovery', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/wallet recovered successfully/i)
      ).toBeInTheDocument();
    });

    // Public key is shown (non-secret but documented here)
    expect(screen.getByText(STUB_PUBLIC_KEY)).toBeInTheDocument();
  });
});

// ── Security: no automatic clipboard write ────────────────────────────────────

describe('WalletRecovery – clipboard security', () => {
  it('does NOT write to clipboard when recovery succeeds', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/wallet recovered successfully/i)
      ).toBeInTheDocument();
    });

    // Clipboard should never have been written automatically
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows a clipboard security warning after recovery', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/wallet recovered successfully/i)
      ).toBeInTheDocument();
    });

    // A clipboard security warning must be visible after recovery
    expect(
      screen.getAllByText(/clipboard/i).length
    ).toBeGreaterThan(0);
  });

  it('provides a copy button for the recovered public key', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /copy public key/i })
      ).toBeInTheDocument();
    });
  });

  it('copies public key only on explicit button click', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() =>
      screen.getByRole('button', { name: /copy public key/i })
    );

    // Not copied yet
    expect(clipboardUtils.copyWithTTL).not.toHaveBeenCalled();

    // Now click the explicit copy button
    await userEvent.click(
      screen.getByRole('button', { name: /copy public key/i })
    );

    expect(clipboardUtils.copyWithTTL).toHaveBeenCalledWith(
      STUB_PUBLIC_KEY,
      expect.any(Number)
    );
  });

  it('shows "Copied!" feedback after copy button click', async () => {
    const recovered = makeRecoveredWallet();
    const onImport = jest.fn().mockResolvedValue(recovered);

    await renderAndUploadBackup(recovered, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      '1234'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() =>
      screen.getByRole('button', { name: /copy public key/i })
    );
    await userEvent.click(
      screen.getByRole('button', { name: /copy public key/i })
    );

    await waitFor(() => {
      // Use role="status" to avoid matching "copied" in the security notice
      expect(screen.getByRole('status')).toHaveTextContent(/copied/i);
    });
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('WalletRecovery – accessibility', () => {
  it('PIN toggle button has an accessible aria-label', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error={null}
        onClearError={jest.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /show pin|hide pin/i })
    ).toBeInTheDocument();
  });

  it('restore button is disabled when no file is loaded', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error={null}
        onClearError={jest.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /restore wallet/i })
    ).toBeDisabled();
  });
});

// ── Error states ───────────────────────────────────────────────────────────────

describe('WalletRecovery – error handling', () => {
  it('shows a parse error when uploaded file is invalid JSON', async () => {
    const badFile = new File(['not json!!!'], 'bad.json', {
      type: 'application/json',
    });
    const { container } = render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error={null}
        onClearError={jest.fn()}
      />
    );
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await act(async () => {
      await userEvent.upload(fileInput, badFile);
    });

    await waitFor(() => {
      // The component surfaces the JSON SyntaxError message for parse failures.
      // We match on a broader pattern rather than a specific engine message.
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it('shows an incorrect-PIN error when decryption fails', async () => {
    const { DecryptionError } = await import('../../lib/wallet/walletCrypto');
    const onImport = jest
      .fn()
      .mockRejectedValue(new DecryptionError('bad pin'));

    const wallet = makeRecoveredWallet();
    await renderAndUploadBackup(wallet, onImport);

    await userEvent.type(
      screen.getByPlaceholderText(/the pin used when backup was created/i),
      'wrongpin'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /restore wallet/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/incorrect pin/i)).toBeInTheDocument();
    });
  });

  it('surfaces an external error prop when provided', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={false}
        error="Service unavailable"
        onClearError={jest.fn()}
      />
    );
    expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
  });

  it('shows loading state while recovery is in progress', () => {
    render(
      <WalletRecovery
        onImportBackup={jest.fn()}
        loading={true}
        error={null}
        onClearError={jest.fn()}
      />
    );
    expect(
      screen.getByText(/verifying & restoring/i)
    ).toBeInTheDocument();
  });
});
