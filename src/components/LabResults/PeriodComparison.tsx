import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { LabResultItem } from '@/types/lab-results';

interface Period {
  start: string;
  end: string;
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function itemDate(item: LabResultItem): string {
  const date = new Date(item.date);
  return Number.isNaN(date.getTime()) ? '' : dateInputValue(date);
}

function defaultPeriods(data: LabResultItem[]): [Period, Period] {
  const validDates = data.map(itemDate).filter(Boolean).sort();
  const end = validDates[validDates.length - 1] || dateInputValue(new Date());
  const endDate = new Date(`${end}T00:00:00`);
  const latestStart = new Date(endDate);
  latestStart.setDate(latestStart.getDate() - 29);
  const previousEnd = new Date(latestStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 29);
  return [
    { start: dateInputValue(previousStart), end: dateInputValue(previousEnd) },
    { start: dateInputValue(latestStart), end },
  ];
}

function unitOf(item: LabResultItem): string {
  return item.referenceRange?.unit?.trim() || 'No unit';
}

export default function PeriodComparison({ data }: { data: LabResultItem[] }) {
  const [periods, setPeriods] = useState<[Period, Period]>(() => defaultPeriods(data));

  const comparison = useMemo(() => {
    const validRanges = periods.map(
      (period) => Boolean(period.start && period.end && period.start <= period.end)
    );
    if (!validRanges.every(Boolean)) {
      return { error: 'Choose a valid start and end date for each period.' };
    }

    const rangeItems = periods.map((period) =>
      data.filter((item) => {
        const date = itemDate(item);
        return date >= period.start && date <= period.end;
      })
    );
    const units = rangeItems.map((items) => new Set(items.map(unitOf)));

    if (units.some((periodUnits) => periodUnits.size > 1)) {
      return { error: 'Each period must contain results in one unit to compare safely.' };
    }

    const firstUnit = units[0].values().next().value as string | undefined;
    const secondUnit = units[1].values().next().value as string | undefined;
    if (firstUnit && secondUnit && firstUnit !== secondUnit) {
      return {
        error: `These periods use incompatible units (${firstUnit} and ${secondUnit}); they cannot be overlaid.`,
      };
    }

    const periodDays = periods.map(
      (period) => dayNumber(period.end) - dayNumber(period.start) + 1
    );
    const maxDays = Math.max(...periodDays);
    const makeDayValues = (items: LabResultItem[], period: Period, days: number) => {
      const byDay = new Map<number, number>();
      items.forEach((item) => {
        const date = itemDate(item);
        const value =
          typeof item.value === 'number'
            ? item.value
            : /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(String(item.value).trim())
              ? Number(item.value)
              : null;
        if (value === null || !Number.isFinite(value)) return;
        byDay.set(dayNumber(date) - dayNumber(period.start), value);
      });
      return Array.from({ length: maxDays }, (_, index) =>
        index < days ? (byDay.get(index) ?? null) : null
      );
    };
    const series = rangeItems.map((items, index) =>
      makeDayValues(items, periods[index], periodDays[index])
    );
    return {
      rows: Array.from({ length: maxDays }, (_, index) => ({
        day: index + 1,
        earlier: series[0][index],
        later: series[1][index],
      })),
      units: firstUnit || secondUnit || '',
      hasResults: rangeItems.some((items) => items.length > 0),
    };
  }, [data, periods]);

  const updatePeriod = (index: 0 | 1, field: keyof Period, value: string) => {
    setPeriods((current) => {
      const next: [Period, Period] = [{ ...current[0] }, { ...current[1] }];
      next[index][field] = value;
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 space-y-4">
      <div>
        <h4 className="font-semibold text-gray-900">Compare two periods</h4>
        <p className="text-xs text-gray-500 mt-1">
          Comparing {data[0]?.testName || 'this metric'}. Missing days remain blank.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {periods.map((period, index) => (
          <fieldset key={index} className="grid grid-cols-2 gap-2">
            <legend className="col-span-2 text-xs font-semibold text-gray-700">
              {index === 0 ? 'Earlier period' : 'Later period'}
            </legend>
            <label className="text-xs text-gray-600">
              From
              <input
                type="date"
                value={period.start}
                onChange={(event) => updatePeriod(index as 0 | 1, 'start', event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              To
              <input
                type="date"
                value={period.end}
                onChange={(event) => updatePeriod(index as 0 | 1, 'end', event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
              />
            </label>
          </fieldset>
        ))}
      </div>
      {'error' in comparison ? (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {comparison.error}
        </p>
      ) : !comparison.hasResults ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          No numeric observations were found in either period.
        </p>
      ) : (
        <>
          <div className="h-64" role="img" aria-label="Comparison of the selected date periods">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparison.rows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  type="number"
                  domain={[1, 'dataMax']}
                  allowDecimals={false}
                  label={{ value: 'Day in period', position: 'insideBottom', offset: -5 }}
                />
                <YAxis />
                <Tooltip />
                <Line
                  type="linear"
                  dataKey="earlier"
                  name={`Earlier period (${comparison.units})`}
                  stroke="#64748b"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="linear"
                  dataKey="later"
                  name={`Later period (${comparison.units})`}
                  stroke="#2563eb"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600" aria-hidden="true">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />Earlier period</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Later period</span>
          </div>
        </>
      )}
    </section>
  );
}
