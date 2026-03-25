import * as StellarSdk from '@stellar/stellar-sdk';
import { 
  StellarConfig, 
  TransactionResult, 
  AccountDetails, 
  SubmitOptions 
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
      throw new Error(`Failed to load account ${publicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      if (response.ok) {
        return true;
      }
      const data = await response.json();
      throw new Error(data.detail || 'Friendbot request failed');
    } catch (error) {
      throw new Error(`Failed to fund account ${publicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a transaction with optimal fee and timeout
   */
  async buildTransaction(
    sourcePublicKey: string, 
    operations: StellarSdk.xdr.Operation<StellarSdk.Operation> | StellarSdk.Operation[],
    options?: SubmitOptions
  ): Promise<StellarSdk.Transaction> {
    const account = await this.server.loadAccount(sourcePublicKey);
    const fee = options?.baseFee || await this.getOptimalFee();

    const builder = new StellarSdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: this.config.networkPassphrase,
      memo: options?.memo,
    });

    if (Array.isArray(operations)) {
      operations.forEach(op => builder.addOperation(op));
    } else {
      builder.addOperation(operations as any); // Handle single operation
    }

    return builder.setTimeout(StellarSdk.TimeoutInfinite).build();
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

    while (attempt < maxAttempts) {
      try {
        const response = await this.server.submitTransaction(transaction);
        return {
          success: true,
          hash: response.hash,
          ledger: response.ledger,
          feeCharged: response.fee_charged,
        };
      } catch (error: any) {
        attempt++;
        const status = error?.response?.status;
        const resultXdr = error?.response?.data?.extras?.result_codes?.transaction;

        // Common retryable errors: Timeout, bad sequence (if we update it), or network hiccups
        const isRetryable = status === 504 || resultXdr === 'tx_bad_seq';

        if (isRetryable && attempt < maxAttempts) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          
          if (resultXdr === 'tx_bad_seq') {
             // If sequence is bad, we'd ideally rebuild the tx with fresh sequence.
             // For simplicity here, we notice it and let the caller handle higher-level retries if needed.
             // Or we could reload the account and rebuild if we had the original builder info.
          }
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
