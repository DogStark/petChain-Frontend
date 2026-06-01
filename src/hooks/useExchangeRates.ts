import { useState, useEffect, useCallback } from 'react';

export interface ExchangeRate {
  symbol: string;
  name: string;
  rate: number;
  change24h: number;
  timestamp: number;
}

export interface HistoricalRate {
  timestamp: number;
  rate: number;
}

interface UseExchangeRatesReturn {
  rates: ExchangeRate[];
  historicalData: HistoricalRate[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshRates: () => Promise<void>;
}

// Mock data for demonstration - in production, this would call a real API
const MOCK_RATES: ExchangeRate[] = [
  {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    rate: 0.12,
    change24h: 2.5,
    timestamp: Date.now(),
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    rate: 1.0,
    change24h: 0.1,
    timestamp: Date.now(),
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    rate: 42500.0,
    change24h: 3.2,
    timestamp: Date.now(),
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    rate: 2250.0,
    change24h: 1.8,
    timestamp: Date.now(),
  },
];

const generateHistoricalData = (): HistoricalRate[] => {
  const data: HistoricalRate[] = [];
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  for (let i = 23; i >= 0; i--) {
    const baseRate = 0.12;
    const variance = (Math.random() - 0.5) * 0.02;
    data.push({
      timestamp: now - i * oneHourMs,
      rate: baseRate + variance,
    });
  }

  return data;
};

export const useExchangeRates = (): UseExchangeRatesReturn => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In production, replace this with actual API calls
      // Example: const response = await fetch('https://api.example.com/rates');
      // const data = await response.json();

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      setRates(MOCK_RATES);
      setHistoricalData(generateHistoricalData());
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange rates');
      console.error('Error fetching exchange rates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch rates on mount
  useEffect(() => {
    fetchRates();

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchRates, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchRates]);

  return {
    rates,
    historicalData,
    loading,
    error,
    lastUpdated,
    refreshRates: fetchRates,
  };
};
