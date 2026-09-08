import { AlertCircle, CheckCircle2, AlertTriangle, Info, Calendar, Building2, FlaskConical } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';

import type { LabResultItem, ReferenceRange } from '@/types/lab-results';

export interface TrendsChartProps {
  data: LabResultItem[];
  testName?: string;
  className?: string;
}

interface ProcessedPoint {
  id: string;
  date: string;
  dateFormatted: string;
  fullDate: string;
  value: number | string;
  numericValue: number;
  unit: string;
  referenceRange?: ReferenceRange;
  isAbnormal?: boolean;
  sourceLab?: string;
  notes?: string;
  statusLabel: 'Low' | 'High' | 'Normal' | 'Abnormal';
  originalItem: LabResultItem;
}

/** Safely parse numeric value from number or string, returning null for qualitative text */
function parseNumericValue(val: number | string | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;
  // Check if string is strictly numeric (disallowing qualitative strings like "2+", "Positive", "Trace")
  if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(str)) {
    const parsed = parseFloat(str);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Determine status label based on value and reference range */
function getStatusLabel(
  numericValue: number,
  isAbnormal?: boolean,
  range?: ReferenceRange
): 'Low' | 'High' | 'Normal' | 'Abnormal' {
  if (range && typeof range.min === 'number' && typeof range.max === 'number') {
    if (numericValue < range.min) return 'Low';
    if (numericValue > range.max) return 'High';
    return 'Normal';
  }
  if (isAbnormal === true) return 'Abnormal';
  if (isAbnormal === false) return 'Normal';
  return 'Normal';
}

export default function TrendsChart({ data, testName, className = '' }: TrendsChartProps) {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // 1. Separate numeric points from qualitative/unplottable points
  const { numericItems, qualitativeItems } = useMemo(() => {
    if (!data || data.length === 0) {
      return { numericItems: [], qualitativeItems: [] };
    }

    const numeric: LabResultItem[] = [];
    const qualitative: LabResultItem[] = [];

    // Sort chronologically ascending
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedData.forEach((item) => {
      const num = parseNumericValue(item.value);
      if (num !== null) {
        numeric.push(item);
      } else {
        qualitative.push(item);
      }
    });

    return { numericItems: numeric, qualitativeItems: qualitative };
  }, [data]);

  // 2. Group numeric items by their unit
  const unitGroups = useMemo(() => {
    const groups = new Map<string, LabResultItem[]>();
    numericItems.forEach((item) => {
      const unitKey = item.referenceRange?.unit?.trim() || 'No unit';
      if (!groups.has(unitKey)) {
        groups.set(unitKey, []);
      }
      groups.get(unitKey)!.push(item);
    });
    return groups;
  }, [numericItems]);

  const availableUnits = useMemo(() => Array.from(unitGroups.keys()), [unitGroups]);

  // Active unit selection (default to unit of most recent numeric item)
  const activeUnit = useMemo(() => {
    if (availableUnits.length === 0) return '';
    if (selectedUnit && unitGroups.has(selectedUnit)) {
      return selectedUnit;
    }
    // Default to the unit of the latest numeric item
    const latestItem = numericItems[numericItems.length - 1];
    const latestUnit = latestItem?.referenceRange?.unit?.trim() || availableUnits[0];
    return latestUnit;
  }, [availableUnits, selectedUnit, unitGroups, numericItems]);

  // 3. Process chart data for the active unit
  const chartData: ProcessedPoint[] = useMemo(() => {
    const itemsForUnit = unitGroups.get(activeUnit) || [];
    return itemsForUnit.map((item) => {
      const numericValue = parseNumericValue(item.value) ?? 0;
      const refRange = item.referenceRange;
      const sourceLab = item.sourceLab || item.referenceRange?.sourceLab;
      const statusLabel = getStatusLabel(numericValue, item.isAbnormal, refRange);

      return {
        id: item.id,
        date: item.date,
        dateFormatted: new Date(item.date).toLocaleDateString(undefined, {
          month: 'short',
          year: '2-digit',
        }),
        fullDate: new Date(item.date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        value: item.value,
        numericValue,
        unit: refRange?.unit?.trim() || activeUnit,
        referenceRange: refRange,
        isAbnormal: item.isAbnormal ?? (statusLabel !== 'Normal'),
        sourceLab,
        notes: item.notes || refRange?.notes,
        statusLabel,
        originalItem: item,
      };
    });
  }, [activeUnit, unitGroups]);

  // Determine active/selected point for provenance inspection
  const activePoint = useMemo(() => {
    if (chartData.length === 0) return null;
    if (selectedPointId) {
      const found = chartData.find((p) => p.id === selectedPointId);
      if (found) return found;
    }
    // Default to latest point
    return chartData[chartData.length - 1];
  }, [chartData, selectedPointId]);

  // Check if reference ranges vary across points
  const { hasVaryingRanges } = useMemo(() => {
    const ranges = chartData
      .map((d) => ({
        range: d.referenceRange,
        lab: d.sourceLab,
      }))
      .filter((r): r is { range: ReferenceRange; lab?: string } =>
        Boolean(r.range && typeof r.range.min === 'number' && typeof r.range.max === 'number')
      );

    if (ranges.length <= 1) {
      return { hasVaryingRanges: false };
    }

    const first = ranges[0];
    const varies = ranges.some(
      (r) =>
        r.range.min !== first.range.min ||
        r.range.max !== first.range.max ||
        r.range.unit !== first.range.unit ||
        r.lab !== first.lab
    );
    return { hasVaryingRanges: varies };
  }, [chartData]);

  // Compute safe Y-Domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const values = chartData.map((d) => d.numericValue);
    
    // Include reference range min/max in domain calculation if available
    chartData.forEach((d) => {
      if (d.referenceRange && typeof d.referenceRange.min === 'number' && typeof d.referenceRange.max === 'number') {
        values.push(d.referenceRange.min);
        values.push(d.referenceRange.max);
      }
    });

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.2 || (max !== 0 ? Math.abs(max) * 0.2 : 5);
    return [Math.max(0, Number((min - padding).toFixed(2))), Number((max + padding).toFixed(2))];
  }, [chartData]);

  // Fallback Reference Area
  const activeRefRange = activePoint?.referenceRange || chartData[0]?.referenceRange;

  // ── Render: Empty State ──
  if (!data || data.length === 0) {
    return (
      <div className={`h-64 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 gap-2 p-6 text-center ${className}`}>
        <FlaskConical className="w-8 h-8 text-gray-400" />
        <p className="font-medium">No historical data available</p>
        <p className="text-xs">Select a test with multiple entries to see trends.</p>
      </div>
    );
  }

  // ── Render: Purely Qualitative Series (Rejection of non-numeric series from line chart) ──
  if (numericItems.length === 0 && qualitativeItems.length > 0) {
    return (
      <div className={`flex flex-col gap-4 bg-amber-50/60 border border-amber-200 rounded-2xl p-5 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900 text-sm">Qualitative Test Series</h4>
            <p className="text-xs text-amber-700 mt-1">
              This test series contains qualitative / non-numeric results ({qualitativeItems.length}{' '}
              {qualitativeItems.length === 1 ? 'entry' : 'entries'}). Cannot plot a numerical trendline.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/70 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 text-xs font-semibold text-amber-900 uppercase tracking-wider flex justify-between">
            <span>Date</span>
            <span>Result Value</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {qualitativeItems.map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                </div>
                <span className="font-semibold text-gray-800">{String(item.value)}</span>
                <div>
                  {item.isAbnormal ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3" /> Abnormal
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" /> Normal
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Custom Tooltip with Full Provenance ──
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ProcessedPoint }>;
  }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-3.5 rounded-xl shadow-xl border border-gray-100 max-w-xs text-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-gray-100 pb-1.5">
            <span className="font-semibold text-gray-800">{dataPoint.fullDate}</span>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                dataPoint.isAbnormal ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
              }`}
            >
              {dataPoint.statusLabel}
            </span>
          </div>

          <div className="my-1.5">
            <span className="text-gray-500 block text-[11px]">Reported Value:</span>
            <span
              className={`font-bold text-base ${
                dataPoint.isAbnormal ? 'text-red-600' : 'text-blue-600'
              }`}
            >
              {dataPoint.value} {dataPoint.unit}
            </span>
          </div>

          <div className="pt-1.5 border-t border-gray-100 space-y-1 text-gray-500">
            <div className="flex items-center justify-between gap-2">
              <span>Reference Range:</span>
              <span className="font-medium text-gray-700">
                {dataPoint.referenceRange
                  ? `${dataPoint.referenceRange.min} – ${dataPoint.referenceRange.max} ${dataPoint.referenceRange.unit}`
                  : 'None provided'}
              </span>
            </div>
            {dataPoint.sourceLab && (
              <div className="flex items-center justify-between gap-2 text-gray-400 text-[10px]">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Lab:
                </span>
                <span className="truncate max-w-[120px]">{dataPoint.sourceLab}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      role="region"
      aria-label={`Lab result trend chart${testName ? ` for ${testName}` : ''}`}
      className={`flex flex-col gap-4 ${className}`}
    >
      {/* ── Unit Separation Tabs (if multiple units exist) ── */}
      {availableUnits.length > 1 && (
        <div className="flex flex-col gap-1.5 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
          <div className="flex items-center justify-between text-xs text-blue-900 font-medium">
            <span>Displaying data for unit: <strong>{activeUnit}</strong></span>
            <span className="text-[11px] text-blue-600 font-normal">
              {availableUnits.length} units detected
            </span>
          </div>
          <div role="tablist" aria-label="Select unit series" className="flex flex-wrap gap-2 mt-1">
            {availableUnits.map((u) => {
              const isActive = u === activeUnit;
              const count = unitGroups.get(u)?.length || 0;
              return (
                <button
                  key={u}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    setSelectedUnit(u);
                    setSelectedPointId(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span>{u}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mixed Series Notice (if qualitative entries are excluded from numeric plot) ── */}
      {qualitativeItems.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {qualitativeItems.length} qualitative/non-numeric{' '}
            {qualitativeItems.length === 1 ? 'entry' : 'entries'} excluded from trendline (
            {qualitativeItems.map((q) => `"${q.value}" on ${new Date(q.date).toLocaleDateString()}`).join(', ')}).
          </span>
        </div>
      )}

      {/* ── Single Data Point Notice ── */}
      {chartData.length === 1 && (
        <div className="flex items-center gap-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-800">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Single test entry on {chartData[0].fullDate}. Subsequent tests with compatible units will form a trendline.
          </span>
        </div>
      )}

      {/* ── Chart Container ── */}
      <div className="h-72 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="dateFormatted"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              dy={10}
            />
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />

            {/* Shaded Reference Area */}
            {activeRefRange &&
              typeof activeRefRange.min === 'number' &&
              typeof activeRefRange.max === 'number' && (
                <ReferenceArea
                  y1={activeRefRange.min}
                  y2={activeRefRange.max}
                  fill="#eff6ff"
                  fillOpacity={0.6}
                  stroke="#bfdbfe"
                  strokeDasharray="2 2"
                />
              )}

            <Line
              type="monotone"
              dataKey="numericValue"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, fill: '#db2777', strokeWidth: 0 }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* ── Standard Legend ── */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
          {activeRefRange && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-50 rounded-sm border border-blue-200" />
              <span>
                Normal Range ({activeRefRange.min}–{activeRefRange.max} {activeRefRange.unit || activeUnit})
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <span>Result Value ({activeUnit || 'units'})</span>
          </div>
        </div>
      </div>

      {/* ── Reference Range Provenance Notice & History Breakdown ── */}
      {hasVaryingRanges && (
        <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600">
          <div className="flex items-center gap-2 font-medium text-gray-700">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Reference ranges vary across dates or source labs:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chartData.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100 text-[11px]"
              >
                <div className="flex items-center gap-1.5 font-medium text-gray-700">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span>{d.dateFormatted}:</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-800">
                    {d.referenceRange
                      ? `${d.referenceRange.min} – ${d.referenceRange.max} ${d.referenceRange.unit}`
                      : 'None'}
                  </span>
                  {d.sourceLab && (
                    <span className="block text-[10px] text-gray-400 font-normal">
                      {d.sourceLab}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Interactive Point Provenance Card & Keyboard Navigation ── */}
      {chartData.length > 0 && (
        <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Point Provenance Details
            </h5>
            <div className="flex gap-1">
              {chartData.map((point) => {
                const isSelected = activePoint?.id === point.id;
                return (
                  <button
                    key={point.id}
                    type="button"
                    role="button"
                    aria-label={`View result for ${point.dateFormatted}: ${point.value} ${point.unit}`}
                    onClick={() => setSelectedPointId(point.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {point.dateFormatted}
                  </button>
                );
              })}
            </div>
          </div>

          {activePoint && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Test Date</span>
                <span className="font-semibold text-gray-800">{activePoint.fullDate}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Result</span>
                <span
                  className={`font-bold text-sm ${
                    activePoint.isAbnormal ? 'text-red-600' : 'text-blue-600'
                  }`}
                >
                  {activePoint.value} {activePoint.unit}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Reference Range</span>
                <span className="font-medium text-gray-700">
                  {activePoint.referenceRange
                    ? `${activePoint.referenceRange.min} – ${activePoint.referenceRange.max} ${activePoint.referenceRange.unit}`
                    : 'No reference range provided'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Evaluation</span>
                <div>
                  {activePoint.statusLabel === 'Normal' ? (
                    <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Within normal range
                    </span>
                  ) : activePoint.statusLabel === 'Low' ? (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Below normal
                    </span>
                  ) : activePoint.statusLabel === 'High' ? (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Above normal
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Abnormal
                    </span>
                  )}
                </div>
              </div>

              {activePoint.sourceLab && (
                <div className="col-span-2 sm:col-span-4 pt-2 border-t border-gray-100 flex items-center gap-2 text-gray-500 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Lab Source: <strong>{activePoint.sourceLab}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
