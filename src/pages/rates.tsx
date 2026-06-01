import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRightLeft,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useExchangeRates, ExchangeRate, HistoricalRate } from '../hooks/useExchangeRates';

interface ConversionInput {
  from: string;
  to: string;
  amount: number;
}

export default function RatesPage() {
  const { rates, historicalData, loading, error, lastUpdated, refreshRates } = useExchangeRates();
  const [conversion, setConversion] = useState<ConversionInput>({
    from: 'XLM',
    to: 'USDC',
    amount: 1,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshRates();
    setIsRefreshing(false);
  };

  const convertedAmount = useMemo(() => {
    const fromRate = rates.find((r) => r.symbol === conversion.from);
    const toRate = rates.find((r) => r.symbol === conversion.to);

    if (!fromRate || !toRate) return 0;

    // Convert to USD first, then to target currency
    const amountInUSD = conversion.amount * fromRate.rate;
    return amountInUSD / toRate.rate;
  }, [conversion, rates]);

  const swapCurrencies = () => {
    setConversion((prev) => ({
      ...prev,
      from: prev.to,
      to: prev.from,
    }));
  };

  const formatChartData = (data: HistoricalRate[]) => {
    return data.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      rate: parseFloat(item.rate.toFixed(4)),
      timestamp: item.timestamp,
    }));
  };

  const getRateChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getRateChangeBg = (change: number) => {
    return change >= 0 ? 'bg-green-50' : 'bg-red-50';
  };

  return (
    <>
      <Head>
        <title>Exchange Rates - PetChain</title>
        <meta name="description" content="View current XLM and token exchange rates" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Exchange Rates</h1>
            <p className="text-slate-600">
              Real-time cryptocurrency and token exchange rates for informed transactions
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Rates</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && !rates.length ? (
            <div className="rounded-lg bg-white shadow-sm p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                <RefreshCw className="text-blue-600 animate-spin" size={24} />
              </div>
              <p className="text-slate-600">Loading exchange rates...</p>
            </div>
          ) : (
            <>
              {/* Refresh Button and Last Updated */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock size={16} />
                  {lastUpdated && (
                    <span>
                      Last updated: {lastUpdated.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {rates.map((rate) => (
                  <div
                    key={rate.symbol}
                    className={`rounded-lg border border-slate-200 p-6 ${getRateChangeBg(rate.change24h)}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{rate.symbol}</h3>
                        <p className="text-sm text-slate-600">{rate.name}</p>
                      </div>
                      {rate.change24h >= 0 ? (
                        <TrendingUp className="text-green-600" size={20} />
                      ) : (
                        <TrendingDown className="text-red-600" size={20} />
                      )}
                    </div>

                    <div className="mb-3">
                      <p className="text-2xl font-bold text-slate-900">
                        ${rate.rate.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 8,
                        })}
                      </p>
                    </div>

                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRateChangeColor(rate.change24h)}`}>
                      {rate.change24h >= 0 ? '+' : ''}
                      {rate.change24h.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Historical Chart */}
              <div className="rounded-lg bg-white shadow-sm p-6 mb-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">XLM Price History (24h)</h2>
                {historicalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formatChartData(historicalData)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="time"
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                        domain={['dataMin - 0.01', 'dataMax + 0.01']}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value) => `$${(value as number).toFixed(4)}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No historical data available
                  </div>
                )}
              </div>

              {/* Currency Conversion Calculator */}
              <div className="rounded-lg bg-white shadow-sm p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Currency Converter</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* From Currency */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From
                    </label>
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={conversion.amount}
                        onChange={(e) =>
                          setConversion((prev) => ({
                            ...prev,
                            amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter amount"
                        min="0"
                        step="0.01"
                      />
                      <select
                        value={conversion.from}
                        onChange={(e) =>
                          setConversion((prev) => ({
                            ...prev,
                            from: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {rates.map((rate) => (
                          <option key={rate.symbol} value={rate.symbol}>
                            {rate.symbol} - {rate.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex items-end justify-center">
                    <button
                      onClick={swapCurrencies}
                      className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                      aria-label="Swap currencies"
                    >
                      <ArrowRightLeft size={24} className="text-slate-600" />
                    </button>
                  </div>

                  {/* To Currency */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      To
                    </label>
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={convertedAmount.toFixed(8)}
                        readOnly
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                        placeholder="Converted amount"
                      />
                      <select
                        value={conversion.to}
                        onChange={(e) =>
                          setConversion((prev) => ({
                            ...prev,
                            to: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {rates.map((rate) => (
                          <option key={rate.symbol} value={rate.symbol}>
                            {rate.symbol} - {rate.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Conversion Rate Info */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">1 {conversion.from}</span> ={' '}
                    <span className="font-semibold">
                      {(
                        (rates.find((r) => r.symbol === conversion.from)?.rate || 0) /
                        (rates.find((r) => r.symbol === conversion.to)?.rate || 1)
                      ).toFixed(8)}
                    </span>{' '}
                    <span className="font-semibold">{conversion.to}</span>
                  </p>
                </div>
              </div>

              {/* Rate Source Attribution */}
              <div className="mt-8 rounded-lg bg-slate-50 border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-3">About These Rates</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>
                      Rates are updated every 5 minutes from multiple cryptocurrency data sources
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>
                      All rates are displayed in USD for easy comparison
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>
                      24-hour change percentages reflect price movement over the last 24 hours
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>
                      Rates are for informational purposes only and may not reflect actual transaction rates
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>
                      Always verify rates before making financial transactions
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
