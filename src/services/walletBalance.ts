const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET = 'https://horizon.stellar.org';
const XLM_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd';

export interface BalanceInfo {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  isNative: boolean;
}

export interface WalletBalance {
  publicKey: string;
  balances: BalanceInfo[];
  nativeBalance: number;
  nativeBalanceUSD?: number;
  lastUpdated: Date;
  network: string;
}

export type BalanceUpdateCallback = (balance: WalletBalance) => void;

function getHorizonUrl(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? HORIZON_MAINNET : HORIZON_TESTNET;
}

function parseBalances(stellarBalances: any[]): BalanceInfo[] {
  return stellarBalances.map((b) => ({
    assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    assetIssuer: b.asset_issuer,
    balance: b.balance,
    assetType: b.asset_type,
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
  private cache: Map<string, { balance: WalletBalance; timestamp: number }> = new Map();
  private callbacks: Set<BalanceUpdateCallback> = new Set();
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private cacheTtlMs: number;

  constructor(cacheTtlMs = 30_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async fetchBalance(publicKey: string): Promise<WalletBalance> {
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

    const walletBalance: WalletBalance = {
      publicKey,
      balances,
      nativeBalance,
      nativeBalanceUSD: nativeBalance * xlmPriceUSD,
      lastUpdated: new Date(),
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    };

    this.cache.set(publicKey, { balance: walletBalance, timestamp: Date.now() });
    this.callbacks.forEach((cb) => cb(walletBalance));
    return walletBalance;
  }

  async refreshBalance(publicKey: string): Promise<WalletBalance> {
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

  getBalanceByAsset(balance: WalletBalance, assetCode: string): BalanceInfo | null {
    return (
      balance.balances.find((b) => (assetCode === 'XLM' ? b.isNative : b.assetCode === assetCode)) ?? null
    );
  }

  formatBalance(balance: string, decimals = 2): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  isSufficientBalance(balance: WalletBalance, amount: number, includeReserve = true): boolean {
    return balance.nativeBalance >= amount + (includeReserve ? 1 : 0);
  }

  isLowBalance(balance: WalletBalance): boolean {
    return balance.nativeBalance < 5;
  }
}

export const walletBalanceService = new WalletBalanceService();
