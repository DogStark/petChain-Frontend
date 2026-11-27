import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarConfig,
  TransactionResult,
  AccountDetails,
  SubmitOptions,
  SigningRequest,
  SigningResult,
} from './types';

export class StellarService {
  private server: StellarSdk.Horizon.Server;
  private config: StellarConfig;

  constructor(config: StellarConfig) {
    this.config = config;
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
  }

  /**
   * Creates a new random Stellar account (Keypair)
   */
  createAccount(): StellarSdk.Keypair {
    return StellarSdk.Keypair.random();
  }

  /**
   * Fetches account details from the Horizon server
   */
  async getAccount(publicKey: string): Promise<AccountDetails> {
    try {
      const account = await this.server.loadAccount(publicKey);
      return {
        publicKey: account.accountId(),
        balances: account.balances,
        sequence: account.sequenceNumber(),
        subentryCount: account.subentry_count,
      };
    } catch (error) {
      throw new Error(
        `Failed to load account ${publicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Funds an account via Friendbot (Testnet only)
   */
  async fundAccount(publicKey: string): Promise<boolean> {
    if (!this.config.isTestnet) {
      throw new Error('Friendbot funding is only available on Testnet');
    }

    try {
      const response = await fetch(`${this.config.friendbotUrl}?addr=${publicKey}`);
      if (response.ok) {
        return true;
      }
      const data = await response.json();
      throw new Error(data.detail || 'Friendbot request failed');
    } catch (error) {
      throw new Error(
        `Failed to fund account ${publicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Builds a transaction with optimal fee and timeout
   */
  async buildTransaction(
    sourcePublicKey: string,
    operations:
      | StellarSdk.xdr.Operation<StellarSdk.Operation>
      | StellarSdk.xdr.Operation<StellarSdk.Operation>[],
    options?: SubmitOptions
  ): Promise<StellarSdk.Transaction> {
    const account = await this.server.loadAccount(sourcePublicKey);
    const fee = options?.baseFee || (await this.getOptimalFee());

    const builder = new StellarSdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: this.config.networkPassphrase,
      memo: options?.memo,
    });

    if (Array.isArray(operations)) {
      operations.forEach((op) => builder.addOperation(op));
    } else {
      builder.addOperation(operations);
    }

    const timeout = options?.timeoutSeconds ?? 30;
    return builder.setTimeout(timeout).build();
  }

  /**
   * Signs a transaction envelope with a software keypair (secret key).
   * The secret key is never persisted or returned.
   */
  signWithKeypair(request: SigningRequest, secretKey: string): SigningResult {
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    if (keypair.publicKey() !== request.publicKey) {
      throw new Error('Secret key does not match the transaction source account');
    }

    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      request.envelopeXdr,
      request.networkPassphrase
    ) as StellarSdk.Transaction;
    transaction.sign(keypair);

    return {
      envelopeXdr: transaction.toEnvelope().toXDR('base64'),
      hash: transaction.hash().toString('hex'),
      signers: [keypair.publicKey()],
    };
  }

  /**
   * Adds a signature produced by an external signer (e.g. a hardware wallet)
   * to a transaction envelope.
   */
  addSignature(request: SigningRequest, signatureBase64: string, publicKey: string): SigningResult {
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      request.envelopeXdr,
      request.networkPassphrase
    ) as StellarSdk.Transaction;
    transaction.addSignature(publicKey, signatureBase64);

    return {
      envelopeXdr: transaction.toEnvelope().toXDR('base64'),
      hash: transaction.hash().toString('hex'),
      signers: [publicKey],
    };
  }

  /**
   * Parses a base64 envelope XDR into a transaction for the given network.
   */
  transactionFromXdr(
    envelopeXdr: string,
    networkPassphrase: string
  ): StellarSdk.Transaction | StellarSdk.FeeBumpTransaction {
    return StellarSdk.TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  }

  /**
   * Computes the hex transaction hash of a signed envelope XDR.
   */
  hashEnvelope(envelopeXdr: string, networkPassphrase: string): string {
    return this.transactionFromXdr(envelopeXdr, networkPassphrase).hash().toString('hex');
  }

  /**
   * Submits a transaction with retry mechanism and error handling
   */
  async submitTransaction(
    transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction,
    options?: SubmitOptions
  ): Promise<TransactionResult> {
    const maxAttempts = options?.retryAttempts ?? 3;
    let attempt = 0;
    let currentTx = transaction;

    while (attempt < maxAttempts) {
      try {
        const response = await this.server.submitTransaction(currentTx);
        return {
          success: true,
          hash: response.hash,
          ledger: response.ledger,
          feeCharged: (response as unknown as { fee_charged?: string }).fee_charged,
        };
      } catch (error: any) {
        attempt++;
        const status = error?.response?.status;
        const resultXdr = error?.response?.data?.extras?.result_codes?.transaction;

        if (resultXdr === 'tx_bad_seq') {
          if (!options?.rebuild) {
            return {
              success: false,
              error: 'Transaction sequence number is stale. The account may have newer pending transactions or an existing sequence was already submitted.',
            };
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            currentTx = await options.rebuild();
            continue;
          }
        }

        // Common retryable errors: network timeouts
        const isRetryable = status === 504;

        if (isRetryable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }

        return {
          success: false,
          error: this.parseStellarError(error),
        };
      }
    }

    return {
      success: false,
      error: 'Max retry attempts reached',
    };
  }

  getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }

  /**
   * Estimates optimal fee based on network congestion
   */
  async getOptimalFee(): Promise<string> {
    try {
      const feeStats = await this.server.feeStats();
      // Use the 'mode' fee as a safe bet, or 'p70' for higher priority
      return feeStats.fee_charged.p70 || StellarSdk.BASE_FEE;
    } catch {
      return StellarSdk.BASE_FEE;
    }
  }

  /**
   * Parses complex Stellar/Horizon errors into readable strings
   */
  private parseStellarError(error: any): string {
    if (error?.response?.data) {
      const { title, detail, extras } = error.response.data;
      let msg = `${title || 'Error'}: ${detail || 'No detail provided'}`;
      if (extras?.result_codes) {
        msg += ` (Result: ${JSON.stringify(extras.result_codes)})`;
      }
      return msg;
    }
    return error instanceof Error ? error.message : 'Unknown communication error';
  }
}
