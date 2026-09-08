import { useRef } from 'react';
import { useHaptic } from '@/hooks/useHaptic';

interface PillOption<T extends string = string> {
  value: T;
  label: string;
  color?: string; // Tailwind classes for selected state
}

interface TouchPillGroupProps<T extends string = string> {
  label: string;
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
  error?: string;
}

/**
 * TouchPillGroup — large pill buttons for selecting one option.
 * Better mobile UX than a <select> for small option sets (≤8 items).
 * Each pill is min 44px tall.
 */
export default function TouchPillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
  error,
}: TouchPillGroupProps<T>) {
  const { trigger } = useHaptic();
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleSelect = (v: T) => {
    trigger('light');
    onChange(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (index - 1 + options.length) % options.length;
    } else {
      return;
    }
    e.preventDefault();
    pillRefs.current[next]?.focus();
    handleSelect(options[next].value);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700" id={`${label}-label`}>{label}</span>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${label}-label`}>
        {options.map((opt, index) => {
          const isSelected = opt.value === value;
          const selectedClass = opt.color ?? 'bg-blue-600 text-white border-blue-600';
          return (
            <button
              key={opt.value}
              ref={(el) => { pillRefs.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => handleSelect(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                min-h-[44px] px-4 rounded-xl border text-sm font-semibold
                transition-all duration-150 touch-manipulation select-none
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                ${
                  isSelected
                    ? `${selectedClass} shadow-sm ring-2 ring-offset-1 ring-blue-400`
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                }
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
