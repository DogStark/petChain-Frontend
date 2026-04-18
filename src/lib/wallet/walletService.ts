import * as StellarSdk from '@stellar/stellar-sdk';
import { encryptSecretKey, decryptSecretKey, computeChecksum } from './walletCrypto';
import { randomUUID } from 'crypto';
import type {
  WalletAccount,
  WalletBalance,
  WalletMonitoringData,
  MultiSigConfig,
  WalletTransaction,
  BroadcastResult,
  BackupData,
  FeeEstimate,
  WalletNetwork,
} from '../../types/wallet';

const STORAGE_KEY = 'petchain_wallets';

function getNetwork(): WalletNetwork {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public' ? 'PUBLIC' : 'TESTNET';
}

function getHorizonUrl(network: WalletNetwork): string {
  return network === 'PUBLIC'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

function getNetworkPassphrase(network: WalletNetwork): string {
  return network === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;
}

class WalletService {
  private network: WalletNetwork;
  private server: StellarSdk.Horizon.Server;

  constructor() {
    this.network = getNetwork();
    this.server = new StellarSdk.Horizon.Server(getHorizonUrl(this.network));
  }

  // ─── Key Generation ──────────────────────────────────────────────────────────

  generateKeypair(): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.random();
    return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
  }

  // ─── Wallet CRUD ─────────────────────────────────────────────────────────────

  async createWallet(label: string, pin: string): Promise<WalletAccount> {
    const { publicKey, secretKey } = this.generateKeypair();
    const { encryptedKey, iv, salt } = await encryptSecretKey(secretKey, pin);

    const wallet: WalletAccount = {
      id: `wallet_${randomUUID()}`,
      publicKey: keypair.publicKey(),
      encryptedSecretKey: encryptedKey,
      iv,
      salt,
      label,
      type: 'standard',
      network: this.network,
      createdAt: new Date().toISOString(),
      backupVerified: true,
    };

    this.persistWallet(wallet);
    return wallet;
  }

  getWallets(): WalletAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getWallet(id: string): WalletAccount | null {
    return this.getWallets().find((w) => w.id === id) ?? null;
  }

  persistWallet(wallet: WalletAccount): void {
    const wallets = this.getWallets();
    const idx = wallets.findIndex((w) => w.id === wallet.id);
    if (idx >= 0) {
      wallets[idx] = wallet;
    } else {
      wallets.push(wallet);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  }

  deleteWallet(id: string): void {
    const wallets = this.getWallets().filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  }

  markBackupVerified(id: string): void {
    const wallet = this.getWallet(id);
    if (wallet) this.persistWallet({ ...wallet, backupVerified: true });
  }

  // ─── PIN / Key Helpers ────────────────────────────────────────────────────────

  async decryptKey(wallet: WalletAccount, pin: string): Promise<string> {
    return decryptSecretKey(wallet.encryptedSecretKey, wallet.iv, wallet.salt, pin);
  }

  async verifyPin(wallet: WalletAccount, pin: string): Promise<boolean> {
    try {
      await this.decryptKey(wallet, pin);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Balance Monitoring ───────────────────────────────────────────────────────

  async fetchAccountData(publicKey: string): Promise<WalletMonitoringData> {
    const account = await this.server.loadAccount(publicKey);
    return {
      publicKey,
      balances: account.balances as WalletBalance[],
      sequence: account.sequence,
      signers: account.signers.map((s) => ({ publicKey: s.key, weight: s.weight })),
      thresholds: {
        low_threshold: account.thresholds.low_threshold,
        med_threshold: account.thresholds.med_threshold,
        high_threshold: account.thresholds.high_threshold,
      },
      lastFetched: new Date().toISOString(),
    };
  }

  // ─── Fee Estimation ───────────────────────────────────────────────────────────

  async estimateFee(): Promise<FeeEstimate> {
    try {
      const stats = await this.server.feeStats();
      return {
        base: stats.fee_charged.min,
        recommended: stats.fee_charged.mode,
        high: stats.fee_charged.p90,
      };
    } catch {
      return {
        base: StellarSdk.BASE_FEE,
        recommended: StellarSdk.BASE_FEE,
        high: StellarSdk.BASE_FEE,
      };
    }
  }

  // ─── Transaction Signing & Broadcasting ──────────────────────────────────────

  async sendPayment(
    wallet: WalletAccount,
    pin: string,
    tx: WalletTransaction
  ): Promise<BroadcastResult> {
    const secretKey = await this.decryptKey(wallet, pin);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const account = await this.server.loadAccount(wallet.publicKey);

    const asset =
      tx.asset === 'XLM'
        ? StellarSdk.Asset.native()
        : (() => {
            const [code, issuer] = tx.asset.split(':');
            return new StellarSdk.Asset(code, issuer);
          })();

    const builder = new StellarSdk.TransactionBuilder(account, {
      fee: tx.fee ?? StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(wallet.network),
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: tx.destination,
        asset,
        amount: tx.amount,
      })
    );

    if (tx.memo) builder.addMemo(StellarSdk.Memo.text(tx.memo));

    const transaction = builder.setTimeout(30).build();
    transaction.sign(keypair);
    const result = await this.server.submitTransaction(transaction);

    return {
      hash: result.hash,
      ledger: (result as any).ledger ?? 0,
      successful: (result as any).successful !== false,
      envelopeXdr: (result as any).envelope_xdr ?? '',
      resultXdr: (result as any).result_xdr ?? '',
    };
  }

  // ─── Multi-Signature Setup ────────────────────────────────────────────────────

  async setupMultiSig(
    wallet: WalletAccount,
    pin: string,
    config: MultiSigConfig
  ): Promise<BroadcastResult> {
    const secretKey = await this.decryptKey(wallet, pin);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const account = await this.server.loadAccount(wallet.publicKey);

    const builder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(wallet.network),
    });

    // Set master weight and thresholds in one operation
    builder.addOperation(
      StellarSdk.Operation.setOptions({
        masterWeight: config.masterWeight,
        lowThreshold: config.lowThreshold,
        medThreshold: config.medThreshold,
        highThreshold: config.highThreshold,
      })
    );

    // Add each co-signer as its own operation
    for (const signer of config.signers) {
      builder.addOperation(
        StellarSdk.Operation.setOptions({
          signer: { ed25519PublicKey: signer.publicKey, weight: signer.weight },
        })
      );
    }

    const transaction = builder.setTimeout(30).build();
    transaction.sign(keypair);
    const result = await this.server.submitTransaction(transaction);

    // Persist updated wallet type
    this.persistWallet({ ...wallet, type: 'multisig' });

    return {
      hash: result.hash,
      ledger: (result as any).ledger ?? 0,
      successful: (result as any).successful !== false,
      envelopeXdr: (result as any).envelope_xdr ?? '',
      resultXdr: (result as any).result_xdr ?? '',
    };
  }

  async removeSigner(
    wallet: WalletAccount,
    pin: string,
    signerPublicKey: string
  ): Promise<BroadcastResult> {
    const secretKey = await this.decryptKey(wallet, pin);
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const account = await this.server.loadAccount(wallet.publicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: getNetworkPassphrase(wallet.network),
    })
      .addOperation(
        StellarSdk.Operation.setOptions({
          signer: { ed25519PublicKey: signerPublicKey, weight: 0 }, // weight 0 = remove
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(keypair);
    const result = await this.server.submitTransaction(transaction);

    return {
      hash: result.hash,
      ledger: (result as any).ledger ?? 0,
      successful: (result as any).successful !== false,
      envelopeXdr: (result as any).envelope_xdr ?? '',
      resultXdr: (result as any).result_xdr ?? '',
    };
  }

  // ─── Backup & Recovery ────────────────────────────────────────────────────────

  async exportBackup(wallet: WalletAccount, pin: string): Promise<BackupData> {
    // Verify PIN before exporting
    await this.decryptKey(wallet, pin);

    const payload = {
      version: 1,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedSecretKey,
      iv: wallet.iv,
      salt: wallet.salt,
      network: wallet.network,
      label: wallet.label,
      createdAt: wallet.createdAt,
    };

    const checksum = await computeChecksum(JSON.stringify(payload));
    return { ...payload, checksum };
  }

  async importBackup(backup: BackupData, pin: string): Promise<WalletAccount> {
    // Verify integrity checksum
    const { checksum, ...payload } = backup;
    const expected = await computeChecksum(JSON.stringify(payload));
    if (checksum !== expected) {
      throw new Error('Backup file is corrupted or has been tampered with.');
    }

    // Verify PIN decrypts correctly
    await decryptSecretKey(backup.encryptedKey, backup.iv, backup.salt, pin);

    const wallet: WalletAccount = {
      id: `wallet_${randomUUID()}`,
      publicKey: backup.publicKey,
      encryptedSecretKey: backup.encryptedKey,
      iv: backup.iv,
      salt: backup.salt,
      label: backup.label,
      type: 'standard',
      network: backup.network as WalletNetwork,
      createdAt: backup.createdAt,
      backupVerified: true,
    };

    this.persistWallet(wallet);
    return wallet;
  }

  // ─── Testnet Funding ──────────────────────────────────────────────────────────

  async fundTestnetAccount(publicKey: string): Promise<void> {
    if (this.network !== 'TESTNET') {
      throw new Error('Friendbot is only available on Testnet.');
    }
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (!res.ok) {
      throw new Error('Friendbot funding failed. The account may already be funded.');
    }
  }
}

export const walletService = new WalletService();
export default walletService;
