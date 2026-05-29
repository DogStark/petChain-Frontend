import { Horizon, Networks, StrKey } from '@stellar/stellar-sdk';
import { requestAccess, isConnected } from '../utils/wallet-bridge';
import { getCurrentNetworkConfig, NETWORK_CHANGE_EVENT, type NetworkConfig } from '../utils/network-config';

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
  xlmPriceUSD?: number;
  totalBalanceUSD?: number;
  lastUpdated: Date;
  network: string;
}

export interface BalanceUpdateCallback {
  (balance: WalletBalance): void;
}

interface StellarBalanceLine {
  asset_type: BalanceInfo['assetType'];
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface StellarAccountLike {
  id: string;
  balances: StellarBalanceLine[];
}

interface WalletTestWindow extends Window {
  __MOCK_STELLAR_ACCOUNT__?: (publicKey: string) => StellarAccountLike;
}

export const balanceUtils = {
  formatBalance: (balance: string, decimals: number = 7): string => {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  formatXLM: (balance: string, decimals: number = 2): string => {
    return `${balanceUtils.formatBalance(balance, decimals)} XLM`;
  },

  getAssetDisplayName: (asset: BalanceInfo): string => {
    if (asset.isNative) return 'Stellar (XLM)';
    return asset.assetCode;
  },

  getBalanceStatusColor: (balance: WalletBalance): string => {
    if (balance.nativeBalance < 1) return 'text-red-400';
    if (balance.nativeBalance < 5) return 'text-amber-400';
    return 'text-sky-400';
  },

  getBalanceStatusText: (balance: WalletBalance): string => {
    if (balance.nativeBalance < 1) return 'Critical balance';
    if (balance.nativeBalance < 5) return 'Low balance';
    return 'Healthy balance';
  }
};

export class WalletBalanceService {
  private server: Horizon.Server;
  private networkConfig: NetworkConfig;
  private balanceCache: Map<string, { balance: WalletBalance; timestamp: number }> = new Map();
  private updateCallbacks: Set<BalanceUpdateCallback> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private priceCache: { price: number; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000;
  private readonly PRICE_CACHE_DURATION = 60000;
  private networkChangeHandler: (() => void) | null = null;

  constructor() {
    this.networkConfig = getCurrentNetworkConfig();
    const horizonUrl = this.networkConfig.rpcUrl.replace('soroban', 'horizon');
    this.server = new Horizon.Server(horizonUrl);
    
    // Listen for network changes
    if (typeof window !== 'undefined') {
      this.networkChangeHandler = () => {
        this.networkConfig = getCurrentNetworkConfig();
        const horizonUrl = this.networkConfig.rpcUrl.replace('soroban', 'horizon');
        this.server = new Horizon.Server(horizonUrl);
        this.clearCache();
      };
      window.addEventListener(NETWORK_CHANGE_EVENT, this.networkChangeHandler);
    }
  }

  clearCache(): void {
    this.balanceCache.clear();
  }

  getCachedBalance(publicKey: string): WalletBalance | null {
    const cached = this.balanceCache.get(publicKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.balance;
    }
    return null;
  }

  async refreshBalance(): Promise<WalletBalance | null> {
    return this.getWalletBalance();
  }

  private async getXlmPriceUSD(): Promise<number | undefined> {
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.PRICE_CACHE_DURATION) {
      return this.priceCache.price;
    }

    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
      if (!response.ok) return undefined;

      const data = (await response.json()) as { stellar?: { usd?: number } };
      const price = data.stellar?.usd;
      if (typeof price !== 'number' || !Number.isFinite(price)) return undefined;

      this.priceCache = { price, timestamp: Date.now() };
      return price;
    } catch {
      return undefined;
    }
  }

  async getWalletBalance(): Promise<WalletBalance | null> {
    try {
      const connectResult = await isConnected();
      if (!connectResult.isConnected) {
        return null;
      }

      const accessResult = await requestAccess();
      console.log('[WalletBalanceService] accessResult:', JSON.stringify(accessResult));
      if (accessResult.error || !accessResult.address) {
        return null;
      }

      const pubKeyString = (accessResult.address || '').trim();
      const isValid = StrKey.isValidEd25519PublicKey(pubKeyString);
      const hex = Array.from(pubKeyString).map(c => c.charCodeAt(0).toString(16)).join(' ');
      console.log(`[WalletBalanceService] pubKeyString: "${pubKeyString}" (valid: ${isValid}, len: ${pubKeyString?.length}, hex: ${hex})`);
      
      if (!isValid) {
        console.error('[WalletBalanceService] Invalid public key detected');
        return null;
      }
      console.log(`[WalletBalanceService] Loading account for ${pubKeyString} from ${this.server.serverURL.toString()}`);
      
      // FOR TESTS: Bypass loadAccount if mock is provided
      let account: StellarAccountLike;
      const testWindow = window as WalletTestWindow;
      if (testWindow.__MOCK_STELLAR_ACCOUNT__) {
        console.log('[WalletBalanceService] Using mock stellar account');
        const mockData = testWindow.__MOCK_STELLAR_ACCOUNT__(pubKeyString);
        account = {
          id: pubKeyString,
          sequence: '100',
          balances: mockData.balances || [{ asset_type: 'native', balance: '1000.00' }]
        } as StellarAccountLike;
      } else {
        account = await this.server.loadAccount(pubKeyString) as StellarAccountLike;
        console.log(`[WalletBalanceService] Account loaded:`, account.id);
      }
      
      const balances = this.parseBalances(account.balances);
      const nativeBalance = this.getNativeBalance(balances);
      const xlmPriceUSD = await this.getXlmPriceUSD();

      const walletBalance: WalletBalance = {
        publicKey: pubKeyString,
        balances,
        nativeBalance,
        xlmPriceUSD,
        totalBalanceUSD: xlmPriceUSD ? nativeBalance * xlmPriceUSD : undefined,
        lastUpdated: new Date(),
        network: this.networkConfig.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      };

      // Update cache
      this.balanceCache.set(pubKeyString, {
        balance: walletBalance,
        timestamp: Date.now()
      });

      // Notify callbacks
      this.notifyUpdate(walletBalance);

      return walletBalance;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return null;
    }
  }

  private parseBalances(stellarBalances: StellarBalanceLine[]): BalanceInfo[] {
    return stellarBalances.map(balance => ({
      assetCode: balance.asset_type === 'native' ? 'XLM' : (balance.asset_code ?? 'UNKNOWN'),
      assetIssuer: balance.asset_issuer,
      balance: balance.balance,
      assetType: balance.asset_type,
      isNative: balance.asset_type === 'native'
    }));
  }

  private getNativeBalance(balances: BalanceInfo[]): number {
    const native = balances.find(b => b.isNative);
    return native ? parseFloat(native.balance) : 0;
  }

  /**
   * Start real-time balance updates
   */
  startRealTimeUpdates(intervalMs: number = 60000): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.getWalletBalance();
    }, intervalMs);
  }

  /**
   * Stop real-time updates
   */
  stopRealTimeUpdates(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  subscribe(callback: BalanceUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  private notifyUpdate(balance: WalletBalance): void {
    this.updateCallbacks.forEach(callback => callback(balance));
  }

  getBalanceByAsset(balance: WalletBalance, assetCode: string, assetIssuer?: string): BalanceInfo | null {
    return balance.balances.find(b => {
      if (assetCode === 'XLM') return b.isNative;
      return b.assetCode === assetCode && b.assetIssuer === assetIssuer;
    }) || null;
  }

  formatBalance(balance: string, decimals: number = 2): string {
    return balanceUtils.formatBalance(balance, decimals);
  }

  isSufficientBalance(balance: WalletBalance, amount: number, includeReserve: boolean = true): boolean {
    const reserve = includeReserve ? 1 : 0; // Basic reserve check
    return balance.nativeBalance >= (amount + reserve);
  }

  isLowBalance(balance: WalletBalance): boolean {
    return balance.nativeBalance < 5;
  }
}

export const walletBalanceService = new WalletBalanceService();
