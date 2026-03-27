import { useRef, useState, useCallback } from 'react';
import { useHaptic } from '@/hooks/useHaptic';

interface TouchSliderProps {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (v: number) => string;
  hint?: string;
  disabled?: boolean;
}

/**
 * TouchSlider — custom range slider with a large 44px touch target thumb,
 * haptic tick feedback, and a visible value bubble.
 */
export default function TouchSlider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  formatValue = v => String(v),
  hint,
  disabled = false,
}: TouchSliderProps) {
  const { trigger } = useHaptic();
  const lastHapticVal = useRef(value);
  const id = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const pct = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    onChange(next);
    // Haptic tick every step boundary
    if (next !== lastHapticVal.current) {
      trigger('light');
      lastHapticVal.current = next;
    }
  }, [onChange, trigger]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <span
          className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg min-w-[2.5rem] text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatValue(value)}
        </span>
      </div>

      {/* Track + thumb wrapper — extra padding for 44px touch area */}
      <div className="relative py-3">
        {/* Filled track */}
        <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-gray-200 pointer-events-none">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue(value)}
          className="
            relative w-full appearance-none bg-transparent cursor-pointer
            disabled:cursor-not-allowed disabled:opacity-50
            touch-manipulation
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-7
            [&::-webkit-slider-thumb]:h-7
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-600
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:active:scale-125
            [&::-moz-range-thumb]:w-7
            [&::-moz-range-thumb]:h-7
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-blue-600
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white
            [&::-moz-range-thumb]:shadow-md
            [&::-webkit-slider-runnable-track]:h-2
            [&::-webkit-slider-runnable-track]:rounded-full
            [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-moz-range-track]:h-2
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-track]:bg-transparent
            focus-visible:outline-none
            focus-visible:[&::-webkit-slider-thumb]:ring-2
            focus-visible:[&::-webkit-slider-thumb]:ring-blue-500
            focus-visible:[&::-webkit-slider-thumb]:ring-offset-2
          "
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400 select-none">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>

      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
