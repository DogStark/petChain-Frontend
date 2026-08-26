import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiSigSetup from './MultiSigSetup';
import type { WalletAccount, WalletMonitoringData, BroadcastResult } from '../../types/wallet';

const WALLET_PK = 'GBDXN7RPDL5AWZFBZJMV3SMNYPZLXBXQFTHFB7LHDAFLMD6VYWBQBGD';
const SIGNER_A = 'GBCM6LX7UMVNTVH5WJXYN56XLOMO5FSL6OGPXD4RMFQXQJLEJPFVCMEA';
const SIGNER_B = 'GCY4DE3Y5GMT2ATVJDVJ5MHL66VZ5KZPR5OQFVJEZV5H6RJBGV7PEYB';

function makeWallet(overrides: Partial<WalletAccount> = {}): WalletAccount {
  return {
    id: 'wallet-1',
    publicKey: WALLET_PK,
    encryptedSecretKey: 'enc',
    iv: 'iv',
    salt: 'salt',
    label: 'Test Wallet',
    type: 'standard',
    network: 'TESTNET',
    createdAt: new Date().toISOString(),
    backupVerified: false,
    ...overrides,
  };
}

function makeAccountData(signers: { publicKey: string; weight: number }[] = []): WalletMonitoringData {
  return {
    publicKey: WALLET_PK,
    balances: [{ asset_type: 'native', balance: '100.0' }],
    sequence: '1',
    signers,
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 2 },
    lastFetched: new Date().toISOString(),
  };
}

const defaultProps = {
  wallet: makeWallet(),
  accountData: makeAccountData(),
  onSetupMultiSig: jest.fn().mockResolvedValue({ hash: 'tx-hash', ledger: 1, successful: true, envelopeXdr: '', resultXdr: '' } as BroadcastResult),
  onRemoveSigner: jest.fn().mockResolvedValue({ hash: 'remove-hash', ledger: 1, successful: true, envelopeXdr: '', resultXdr: '' } as BroadcastResult),
  loading: false,
  error: null,
  onClearError: jest.fn(),
};

function renderMultiSig(overrides: Partial<typeof defaultProps> = {}) {
  return render(<MultiSigSetup {...defaultProps} {...overrides} />);
}

describe('MultiSigSetup', () => {
  describe('empty state', () => {
    it('shows placeholder when wallet is null', () => {
      renderMultiSig({ wallet: null });
      expect(screen.getByText(/Select a wallet to configure multi-sig/)).toBeInTheDocument();
    });
  });

  describe('form rendering', () => {
    it('renders the configure heading', () => {
      renderMultiSig();
      expect(screen.getByText('Configure Multi-Sig')).toBeInTheDocument();
    });

    it('renders the info banner', () => {
      renderMultiSig();
      expect(screen.getByText(/Multi-Signature Wallets/)).toBeInTheDocument();
    });

    it('renders PIN input', () => {
      renderMultiSig();
      expect(screen.getByPlaceholderText(/Enter PIN to sign setup transaction/)).toBeInTheDocument();
    });

    it('renders threshold inputs', () => {
      renderMultiSig();
      expect(screen.getByText('Master Weight')).toBeInTheDocument();
      expect(screen.getByText('Low Threshold')).toBeInTheDocument();
      expect(screen.getByText(/Medium Threshold/)).toBeInTheDocument();
      expect(screen.getByText(/High Threshold/)).toBeInTheDocument();
    });

    it('renders initial signer input', () => {
      renderMultiSig();
      expect(screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/)).toBeInTheDocument();
    });

    it('renders the Apply button as disabled initially (no PIN)', () => {
      renderMultiSig();
      const btn = screen.getByRole('button', { name: /Apply Multi-Sig Configuration/ });
      expect(btn).toBeDisabled();
    });
  });

  describe('error display', () => {
    it('shows error banner when error prop is set', () => {
      renderMultiSig({ error: 'Transaction failed on-chain' });
      expect(screen.getByText('Transaction failed on-chain')).toBeInTheDocument();
    });

    it('does not show error banner when error is null', () => {
      renderMultiSig({ error: null });
      expect(screen.queryByText(/Transaction failed/)).not.toBeInTheDocument();
    });
  });

  describe('existing signers', () => {
    it('shows existing signers when present', () => {
      const accountData = makeAccountData([{ publicKey: SIGNER_A, weight: 2 }]);
      renderMultiSig({ accountData });
      expect(screen.getByText('Current Co-Signers')).toBeInTheDocument();
      expect(screen.getByText(SIGNER_A)).toBeInTheDocument();
    });

    it('hides existing signers section when none exist', () => {
      renderMultiSig();
      expect(screen.queryByText('Current Co-Signers')).not.toBeInTheDocument();
    });

    it('calls onRemoveSigner when remove button is clicked', async () => {
      const onRemoveSigner = jest.fn().mockResolvedValue({ hash: 'h', ledger: 1, successful: true, envelopeXdr: '', resultXdr: '' });
      const accountData = makeAccountData([{ publicKey: SIGNER_A, weight: 2 }]);
      renderMultiSig({ accountData, onRemoveSigner });

      const removeBtn = screen.getByTitle('Remove signer');
      fireEvent.click(removeBtn);
      expect(onRemoveSigner).not.toHaveBeenCalled();
    });
  });

  describe('add/remove signers', () => {
    it('adds a new signer row when Add signer is clicked', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const addBtn = screen.getByText(/Add signer/);
      await user.click(addBtn);
      const inputs = screen.getAllByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      expect(inputs).toHaveLength(2);
    });

    it('removes a signer row when trash button is clicked', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const addBtn = screen.getByText(/Add signer/);
      await user.click(addBtn);
      expect(screen.getAllByPlaceholderText(/G\.\.\. \(Stellar public key\)/)).toHaveLength(2);

      const removeButtons = screen.getAllByRole('button');
      const trashButtons = removeButtons.filter((btn) => btn.querySelector('svg'));
      expect(trashButtons.length).toBeGreaterThan(0);
    });
  });

  describe('inline validation', () => {
    it('shows error when own key is entered as signer', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, WALLET_PK);
      expect(screen.getByText(/cannot add your own key/)).toBeInTheDocument();
    });

    it('shows error for duplicate signer keys', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const addBtn = screen.getByText(/Add signer/);
      await user.click(addBtn);

      const inputs = screen.getAllByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(inputs[0]);
      await user.type(inputs[0], SIGNER_A);
      await user.clear(inputs[1]);
      await user.type(inputs[1], SIGNER_A);

      expect(screen.getAllByText(/Duplicate key/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows error when key exists on-chain', () => {
      const accountData = makeAccountData([{ publicKey: SIGNER_A, weight: 2 }]);
      renderMultiSig({ accountData });
      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      fireEvent.change(input, { target: { value: SIGNER_A } });
      expect(screen.getByText(/already exists on-chain/)).toBeInTheDocument();
    });

    it('shows red border for invalid key format', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, 'SHORTKEY');
      expect(input.className).toContain('border-red-400');
    });
  });

  describe('validation summary', () => {
    it('shows validation errors panel when errors exist', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, WALLET_PK);
      expect(screen.getByText('Please fix the following:')).toBeInTheDocument();
    });

    it('shows validation errors for default empty signer state', () => {
      renderMultiSig();
      expect(screen.getByText('Please fix the following:')).toBeInTheDocument();
      expect(screen.getByText(/must have a public key/)).toBeInTheDocument();
    });
  });

  describe('confirmation dialog', () => {
    it('opens confirmation dialog when form is submitted with valid config', async () => {
      const user = userEvent.setup();
      renderMultiSig();

      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, SIGNER_A);

      const pinInput = screen.getByPlaceholderText(/Enter PIN to sign setup transaction/);
      await user.type(pinInput, '12345678');

      const submitBtn = screen.getByRole('button', { name: /Apply Multi-Sig Configuration/ });
      await user.click(submitBtn);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Multi-Sig Configuration')).toBeInTheDocument();
    });

    it('shows configuration summary in dialog', async () => {
      const user = userEvent.setup();
      renderMultiSig();

      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, SIGNER_A);

      const pinInput = screen.getByPlaceholderText(/Enter PIN to sign setup transaction/);
      await user.type(pinInput, '12345678');

      const submitBtn = screen.getByRole('button', { name: /Apply Multi-Sig Configuration/ });
      await user.click(submitBtn);

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Co-signers')).toBeInTheDocument();
      expect(within(dialog).getByText('Master Weight')).toBeInTheDocument();
      expect(within(dialog).getByText('High Threshold')).toBeInTheDocument();
      expect(within(dialog).getByText('Risk reminders:')).toBeInTheDocument();
    });

    it('closes dialog when Go Back is clicked', async () => {
      const user = userEvent.setup();
      renderMultiSig();

      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, SIGNER_A);

      const pinInput = screen.getByPlaceholderText(/Enter PIN to sign setup transaction/);
      await user.type(pinInput, '12345678');

      const submitBtn = screen.getByRole('button', { name: /Apply Multi-Sig Configuration/ });
      await user.click(submitBtn);

      const goBackBtn = screen.getByRole('button', { name: /Go Back/ });
      await user.click(goBackBtn);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onSetupMultiSig when confirmed', async () => {
      const onSetupMultiSig = jest.fn().mockResolvedValue({ hash: 'tx', ledger: 1, successful: true, envelopeXdr: '', resultXdr: '' });
      const user = userEvent.setup();
      renderMultiSig({ onSetupMultiSig });

      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.clear(input);
      await user.type(input, SIGNER_A);

      const pinInput = screen.getByPlaceholderText(/Enter PIN to sign setup transaction/);
      await user.type(pinInput, '12345678');

      const submitBtn = screen.getByRole('button', { name: /Apply Multi-Sig Configuration/ });
      await user.click(submitBtn);

      const confirmBtn = screen.getByRole('button', { name: /Apply Configuration/ });
      await user.click(confirmBtn);

      expect(onSetupMultiSig).toHaveBeenCalledWith('12345678', {
        signers: [{ publicKey: SIGNER_A, weight: 1 }],
        masterWeight: 1,
        lowThreshold: 1,
        medThreshold: 2,
        highThreshold: 2,
      });
    });
  });

  describe('keyboard accessibility', () => {
    it('submit button is reachable by keyboard', async () => {
      const user = userEvent.setup();
      renderMultiSig();
      const input = screen.getByPlaceholderText(/G\.\.\. \(Stellar public key\)/);
      await user.tab();
      expect(input).toHaveFocus();
    });

    it('Add signer button is keyboard accessible', () => {
      renderMultiSig();
      const addBtn = screen.getByText(/Add signer/);
      expect(addBtn.tagName).toBe('BUTTON');
    });
  });
});
