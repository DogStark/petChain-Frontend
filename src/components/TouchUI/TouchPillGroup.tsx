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

  const handleSelect = (v: T) => {
    trigger('light');
    onChange(v);
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = opt.value === value;
          const selectedClass = opt.color ?? 'bg-blue-600 text-white border-blue-600';
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.value)}
              className={`
                min-h-[44px] px-4 rounded-xl border text-sm font-semibold
                transition-all duration-150 touch-manipulation select-none
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                ${isSelected
                  ? `${selectedClass} shadow-sm ring-2 ring-offset-1 ring-blue-400`
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'}
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
