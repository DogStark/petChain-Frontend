import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

export interface ExchangeRate {
  asset: string;
  symbol: string;
  priceUSD: number;
  priceXLM?: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export interface HistoricalRatePoint {
  timestamp: string;
  priceUSD: number;
  priceXLM?: number;
}

export interface RateHistory {
  asset: string;
  interval: '1h' | '4h' | '1d' | '7d' | '30d';
  data: HistoricalRatePoint[];
}

export interface ConversionResult {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  timestamp: string;
}

export type RateInterval = '1h' | '4h' | '1d' | '7d' | '30d';

// Stellar Horizon and CoinGecko public endpoints for XLM rates
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const STELLAR_HORIZON = 'https://horizon.stellar.org';

class RateAPI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${getApiBaseUrl()}/rates`,
      withCredentials: true,
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Fetch current XLM price from CoinGecko public API
   */
  async getXLMRate(): Promise<ExchangeRate> {
    try {
      const response = await axios.get(`${COINGECKO_BASE}/coins/stellar`, {
        params: {
          localization: false,
          tickers: false,
          community_data: false,
          developer_data: false,
        },
        timeout: 10000,
      });

      const data = response.data;
      const marketData = data.market_data;

      return {
        asset: 'Stellar Lumens',
        symbol: 'XLM',
        priceUSD: marketData.current_price.usd ?? 0,
        change24h: marketData.price_change_percentage_24h ?? 0,
        change7d: marketData.price_change_percentage_7d ?? 0,
        volume24h: marketData.total_volume.usd ?? 0,
        marketCap: marketData.market_cap.usd ?? 0,
        lastUpdated: marketData.last_updated ?? new Date().toISOString(),
      };
    } catch {
      // Fallback to simple price endpoint
      const fallback = await axios.get(`${COINGECKO_BASE}/simple/price`, {
        params: {
          ids: 'stellar',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true,
          include_last_updated_at: true,
        },
        timeout: 10000,
      });

      const d = fallback.data.stellar;
      return {
        asset: 'Stellar Lumens',
        symbol: 'XLM',
        priceUSD: d.usd ?? 0,
        change24h: d.usd_24h_change ?? 0,
        change7d: 0,
        volume24h: d.usd_24h_vol ?? 0,
        marketCap: d.usd_market_cap ?? 0,
        lastUpdated: new Date(d.last_updated_at * 1000).toISOString(),
      };
    }
  }

  /**
   * Fetch rates for multiple assets (XLM + common tokens)
   */
  async getAllRates(): Promise<ExchangeRate[]> {
    const response = await axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: {
        ids: 'stellar,bitcoin,ethereum,usd-coin',
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_24hr_vol: true,
        include_market_cap: true,
        include_last_updated_at: true,
      },
      timeout: 10000,
    });

    const data = response.data;
    const now = new Date().toISOString();

    const assetMap: Record<string, { asset: string; symbol: string }> = {
      stellar: { asset: 'Stellar Lumens', symbol: 'XLM' },
      bitcoin: { asset: 'Bitcoin', symbol: 'BTC' },
      ethereum: { asset: 'Ethereum', symbol: 'ETH' },
      'usd-coin': { asset: 'USD Coin', symbol: 'USDC' },
    };

    return Object.entries(assetMap).map(([id, meta]) => {
      const d = data[id] ?? {};
      return {
        asset: meta.asset,
        symbol: meta.symbol,
        priceUSD: d.usd ?? 0,
        change24h: d.usd_24h_change ?? 0,
        change7d: 0,
        volume24h: d.usd_24h_vol ?? 0,
        marketCap: d.usd_market_cap ?? 0,
        lastUpdated: d.last_updated_at ? new Date(d.last_updated_at * 1000).toISOString() : now,
      };
    });
  }

  /**
   * Fetch historical XLM price data for charting
   */
  async getXLMHistory(days: number = 7): Promise<HistoricalRatePoint[]> {
    const response = await axios.get(`${COINGECKO_BASE}/coins/stellar/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
        interval: days <= 1 ? 'hourly' : 'daily',
      },
      timeout: 15000,
    });

    const prices: [number, number][] = response.data.prices ?? [];
    return prices.map(([ts, price]) => ({
      timestamp: new Date(ts).toISOString(),
      priceUSD: price,
    }));
  }

  /**
   * Convert between two assets using current rates
   */
  async convert(
    fromAsset: string,
    toAsset: string,
    amount: number
  ): Promise<ConversionResult> {
    const idMap: Record<string, string> = {
      XLM: 'stellar',
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDC: 'usd-coin',
      USD: 'usd',
    };

    const fromId = idMap[fromAsset.toUpperCase()];
    const toId = idMap[toAsset.toUpperCase()];

    if (!fromId || !toId) {
      throw new Error(`Unsupported asset pair: ${fromAsset}/${toAsset}`);
    }

    // USD is the base — get prices in USD
    const ids = [fromId, toId].filter((id) => id !== 'usd').join(',');
    const response = await axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: { ids, vs_currencies: 'usd' },
      timeout: 10000,
    });

    const fromPriceUSD = fromId === 'usd' ? 1 : (response.data[fromId]?.usd ?? 1);
    const toPriceUSD = toId === 'usd' ? 1 : (response.data[toId]?.usd ?? 1);

    const rate = fromPriceUSD / toPriceUSD;
    const toAmount = amount * rate;

    return {
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount,
      rate,
      fee: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get Stellar network fee stats from Horizon
   */
  async getNetworkFeeStats(): Promise<{
    baseFee: string;
    p50Fee: string;
    p70Fee: string;
    p99Fee: string;
  }> {
    const response = await axios.get(`${STELLAR_HORIZON}/fee_stats`, { timeout: 8000 });
    const d = response.data;
    return {
      baseFee: d.last_ledger_base_fee ?? '100',
      p50Fee: d.fee_charged?.p50 ?? '100',
      p70Fee: d.fee_charged?.p70 ?? '100',
      p99Fee: d.fee_charged?.p99 ?? '100',
    };
  }
}

export const rateAPI = new RateAPI();
