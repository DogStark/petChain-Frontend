/**
 * WalletBalanceService
 *
 * Responsibility: standalone balance-polling service for Stellar accounts.
 * Fetches account balance data directly from the Horizon REST API (not via
 * walletService) and maintains an in-memory TTL cache to avoid rate-limiting.
 *
 * Boundary contract:
 *   - This service owns the balance-polling concern only.
 *   - It does NOT manage key material, wallet lifecycle, or transaction signing
 *     — those belong to walletService (src/lib/wallet/walletService.ts).
 *   - It does NOT perform server-side wallet registration — that belongs to
 *     walletAPI (src/lib/api/walletAPI.ts).
 *
 * Type naming note:
 *   `AccountBalance` (this file) — account-level aggregate: publicKey, list of
 *   per-asset balances, native XLM total, and USD equivalent.
 *
 *   `WalletBalance` (src/types/wallet.ts) — Stellar per-asset balance record
 *   returned verbatim from the Horizon API (asset_type, asset_code, etc.).
 *   The two types serve different purposes and must not be confused.
 */

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET = 'https://horizon.stellar.org';
const XLM_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd';

/** A single asset balance entry parsed from the Horizon accounts response. */
export interface BalanceInfo {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  isNative: boolean;
}

/**
 * Account-level balance aggregate returned by WalletBalanceService.
 *
 * This is distinct from `WalletBalance` in `src/types/wallet.ts`, which models
 * a single per-asset Horizon record. `AccountBalance` aggregates all balances
 * for one Stellar account along with its native XLM total and USD equivalent.
 */
export interface AccountBalance {
  publicKey: string;
  balances: BalanceInfo[];
  nativeBalance: number;
  nativeBalanceUSD?: number;
  lastUpdated: Date;
  network: string;
}

export type BalanceUpdateCallback = (balance: AccountBalance) => void;

function getHorizonUrl(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? HORIZON_MAINNET : HORIZON_TESTNET;
}

function parseBalances(stellarBalances: Array<{
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}>): BalanceInfo[] {
  return stellarBalances.map((b) => ({
    assetCode: b.asset_type === 'native' ? 'XLM' : (b.asset_code ?? ''),
    assetIssuer: b.asset_issuer,
    balance: b.balance,
    assetType: b.asset_type as BalanceInfo['assetType'],
    isNative: b.asset_type === 'native',
  }));
}

async function fetchXlmPriceUSD(): Promise<number> {
  try {
    const res = await fetch(XLM_PRICE_URL);
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.stellar?.usd ?? 0;
  } catch {
    return 0;
  }
}

class WalletBalanceService {
  private cache: Map<string, { balance: AccountBalance; timestamp: number }> = new Map();
  private callbacks: Set<BalanceUpdateCallback> = new Set();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private cacheTtlMs: number;

  constructor(cacheTtlMs = 30_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async fetchBalance(publicKey: string): Promise<AccountBalance> {
    const cached = this.cache.get(publicKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.balance;
    }

    const res = await fetch(`${getHorizonUrl()}/accounts/${publicKey}`);

    if (res.status === 404) throw new Error('Account not found on the Stellar network');
    if (!res.ok) throw new Error(`Horizon request failed: ${res.status}`);

    const account = await res.json();
    const balances = parseBalances(account.balances ?? []);
    const nativeInfo = balances.find((b) => b.isNative);
    const nativeBalance = nativeInfo ? parseFloat(nativeInfo.balance) : 0;
    const xlmPriceUSD = await fetchXlmPriceUSD();

    const accountBalance: AccountBalance = {
      publicKey,
      balances,
      nativeBalance,
      nativeBalanceUSD: nativeBalance * xlmPriceUSD,
      lastUpdated: new Date(),
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    };

    this.cache.set(publicKey, { balance: accountBalance, timestamp: Date.now() });
    this.callbacks.forEach((cb) => cb(accountBalance));
    return accountBalance;
  }

  async refreshBalance(publicKey: string): Promise<AccountBalance> {
    this.cache.delete(publicKey);
    return this.fetchBalance(publicKey);
  }

  subscribe(callback: BalanceUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  startAutoRefresh(publicKey: string, intervalMs = 30_000): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => this.fetchBalance(publicKey), intervalMs);
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  getBalanceByAsset(balance: AccountBalance, assetCode: string): BalanceInfo | null {
    return (
      balance.balances.find((b) => (assetCode === 'XLM' ? b.isNative : b.assetCode === assetCode)) ?? null
    );
  }

  formatBalance(balance: string, decimals = 2): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  isSufficientBalance(balance: AccountBalance, amount: number, includeReserve = true): boolean {
    return balance.nativeBalance >= amount + (includeReserve ? 1 : 0);
  }

  isLowBalance(balance: AccountBalance): boolean {
    return balance.nativeBalance < 5;
  }
}

export const walletBalanceService = new WalletBalanceService();
