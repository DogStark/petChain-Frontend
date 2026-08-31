import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, Info } from 'lucide-react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { rateAPI, ExchangeRate, HistoricalRatePoint } from '@/lib/api/rateAPI';
import { GetServerSideProps } from 'next';

// Load chart without SSR (Recharts requires browser APIs)
const RateHistoryChart = dynamic(() => import('@/components/Rate/RateHistoryChart'), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
      Loading chart…
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryInterval = '1' | '7' | '30';

const INTERVAL_LABELS: Record<HistoryInterval, string> = {
  '1': '24h',
  '7': '7d',
  '30': '30d',
};

const SUPPORTED_ASSETS = ['XLM', 'BTC', 'ETH', 'USDC', 'USD'] as const;
type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function ChangeChip({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

// ─── Rate Card ────────────────────────────────────────────────────────────────

function RateCard({
  rate,
  selected,
  onClick,
}: {
  rate: ExchangeRate;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 outline-none ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{rate.symbol}</span>
          <span className="text-xs text-gray-500 truncate max-w-[80px]">{rate.asset}</span>
        </div>
        <ChangeChip value={rate.change24h} />
      </div>
      <p className="text-xl font-bold text-gray-900">{formatPrice(rate.priceUSD)}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>Vol: {formatUSD(rate.volume24h)}</span>
        <span>MCap: {formatUSD(rate.marketCap)}</span>
      </div>
    </button>
  );
}

// ─── Conversion Calculator ────────────────────────────────────────────────────

function ConversionCalculator({ rates }: { rates: ExchangeRate[] }) {
  const [fromAsset, setFromAsset] = useState<SupportedAsset>('XLM');
  const [toAsset, setToAsset] = useState<SupportedAsset>('USD');
  const [fromAmount, setFromAmount] = useState<string>('100');
  const [result, setResult] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);

  // Build a quick price map from loaded rates
  const priceMap = React.useMemo(() => {
    const map: Record<string, number> = { USD: 1 };
    rates.forEach((r) => {
      map[r.symbol] = r.priceUSD;
    });
    return map;
  }, [rates]);

  const handleConvert = useCallback(async () => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      setConvError('Please enter a valid positive amount.');
      return;
    }
    if (fromAsset === toAsset) {
      setResult(amount);
      return;
    }

    setConverting(true);
    setConvError(null);

    try {
      // Use local price map for instant conversion (no extra API call)
      const fromPrice = priceMap[fromAsset] ?? 1;
      const toPrice = priceMap[toAsset] ?? 1;
      const converted = (amount * fromPrice) / toPrice;
      setResult(converted);
    } catch {
      // Fallback to API
      try {
        const res = await rateAPI.convert(fromAsset, toAsset, amount);
        setResult(res.toAmount);
      } catch (err) {
        setConvError('Conversion failed. Please try again.');
      }
    } finally {
      setConverting(false);
    }
  }, [fromAmount, fromAsset, toAsset, priceMap]);

  // Auto-convert when inputs change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      handleConvert();
    } else {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, fromAsset, toAsset, priceMap]);

  const swapAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  };

  const formatResult = (val: number) => {
    if (toAsset === 'USD') return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (val < 0.0001) return val.toFixed(8);
    return val.toFixed(6);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300">
      <h2 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5" />
        Currency Converter
      </h2>

      <div className="space-y-4">
        {/* From */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              placeholder="Amount"
              aria-label="Amount to convert"
            />
            <select
              value={fromAsset}
              onChange={(e) => setFromAsset(e.target.value as SupportedAsset)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label="From currency"
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={swapAssets}
            className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
            aria-label="Swap currencies"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        {/* To */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 min-h-[38px] flex items-center">
              {converting ? (
                <span className="text-gray-400 text-xs">Calculating…</span>
              ) : result !== null ? (
                formatResult(result)
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
            <select
              value={toAsset}
              onChange={(e) => setToAsset(e.target.value as SupportedAsset)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label="To currency"
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {convError && (
          <p className="text-xs text-red-500 mt-1">{convError}</p>
        )}

        {/* Rate hint */}
        {result !== null && !converting && fromAmount && parseFloat(fromAmount) > 0 && (
          <p className="text-xs text-gray-400 text-center">
            1 {fromAsset} ≈{' '}
            {formatResult((result / parseFloat(fromAmount)))} {toAsset}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RatePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [history, setHistory] = useState<HistoricalRatePoint[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>('XLM');
  const [historyInterval, setHistoryInterval] = useState<HistoryInterval>('7');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [feeStats, setFeeStats] = useState<{
    baseFee: string;
    p50Fee: string;
    p70Fee: string;
    p99Fee: string;
  } | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRates, fees] = await Promise.allSettled([
        rateAPI.getAllRates(),
        rateAPI.getNetworkFeeStats(),
      ]);

      if (allRates.status === 'fulfilled') {
        setRates(allRates.value);
        setLastUpdated(new Date());
      } else {
        throw new Error('Failed to fetch exchange rates.');
      }

      if (fees.status === 'fulfilled') {
        setFeeStats(fees.value);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load exchange rates. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (selectedAsset !== 'XLM') {
      // For non-XLM assets, generate placeholder history from current rate
      const rate = rates.find((r) => r.symbol === selectedAsset);
      if (rate) {
        const days = parseInt(historyInterval);
        const points = days * (days <= 1 ? 24 : 1);
        const now = Date.now();
        const generated: HistoricalRatePoint[] = Array.from({ length: points }, (_, i) => {
          const ts = now - (points - i) * (days <= 1 ? 3600000 : 86400000);
          const noise = (Math.random() - 0.5) * 0.04 * rate.priceUSD;
          return { timestamp: new Date(ts).toISOString(), priceUSD: rate.priceUSD + noise };
        });
        setHistory(generated);
      }
      return;
    }

    setHistoryLoading(true);
    try {
      const data = await rateAPI.getXLMHistory(parseInt(historyInterval));
      setHistory(data);
    } catch {
      // Silently fail — chart will show empty state
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedAsset, historyInterval, rates]);

  // Initial load
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Fetch history when asset or interval changes
  useEffect(() => {
    if (rates.length > 0) {
      fetchHistory();
    }
  }, [fetchHistory, rates]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchRates, 60_000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedRate = rates.find((r) => r.symbol === selectedAsset);

  return (
    <>
      <Head>
        <title>Exchange Rates | PetChain</title>
        <meta name="description" content="View live XLM and token exchange rates, historical charts, and currency conversion." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 p-4 md:p-8 flex flex-col transition-all duration-300">
        <div className="mx-auto max-w-7xl w-full">

          {/* ── Header ── */}
          <div className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg transition-all duration-300">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 drop-shadow-sm">
                Exchange Rates
              </h1>
              <p className="mt-1 text-sm md:text-base text-gray-600">
                Live XLM and token rates for payment decisions.
                {lastUpdated && (
                  <span className="ml-2 text-xs text-gray-400">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={fetchRates}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 shadow-md border border-blue-100 hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed self-start md:self-auto"
              aria-label="Refresh rates"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm"
            >
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Failed to load rates</p>
                <p className="text-red-500 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ── Rate Cards Grid ── */}
          {loading && rates.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white/60 animate-pulse border border-gray-100"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {rates.map((rate) => (
                <RateCard
                  key={rate.symbol}
                  rate={rate}
                  selected={selectedAsset === rate.symbol}
                  onClick={() => setSelectedAsset(rate.symbol)}
                />
              ))}
            </div>
          )}

          {/* ── Chart + Calculator ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Historical Chart */}
            <div className="lg:col-span-2 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-blue-700">
                  {selectedRate?.asset ?? selectedAsset} Price History
                </h2>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {(Object.keys(INTERVAL_LABELS) as HistoryInterval[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setHistoryInterval(key)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        historyInterval === key
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      aria-pressed={historyInterval === key}
                    >
                      {INTERVAL_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <RateHistoryChart
                  data={history}
                  symbol={selectedAsset}
                  interval={historyInterval}
                />
              )}
            </div>

            {/* Conversion Calculator */}
            <div className="lg:col-span-1">
              <ConversionCalculator rates={rates} />
            </div>
          </div>

          {/* ── Stellar Network Fee Stats ── */}
          {feeStats && (
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 mb-6">
              <h2 className="text-lg font-bold text-blue-700 mb-4">
                Stellar Network Fee Stats
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Base Fee', value: feeStats.baseFee, hint: 'stroops' },
                  { label: 'Median (p50)', value: feeStats.p50Fee, hint: 'stroops' },
                  { label: 'Recommended (p70)', value: feeStats.p70Fee, hint: 'stroops' },
                  { label: 'High Priority (p99)', value: feeStats.p99Fee, hint: 'stroops' },
                ].map(({ label, value, hint }) => (
                  <div
                    key={label}
                    className="bg-blue-50 rounded-2xl p-4 text-center"
                  >
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-xl font-bold text-blue-700">{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Source Attribution ── */}
          <div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-gray-100 text-xs text-gray-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              Rate data sourced from{' '}
              <a
                href="https://www.coingecko.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                CoinGecko
              </a>{' '}
              and{' '}
              <a
                href="https://horizon.stellar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Stellar Horizon
              </a>
              . Rates auto-refresh every 60 seconds.
            </span>
            <span className="text-gray-300">For informational purposes only.</span>
          </div>

        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
