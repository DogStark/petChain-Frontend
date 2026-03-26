import { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface TouchSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  placeholder?: string;
}

/**
 * TouchSelect — uses the native <select> which gives the best mobile UX
 * (native picker wheel on iOS/Android). Styled to match TouchInput.
 */
const TouchSelect = forwardRef<HTMLSelectElement, TouchSelectProps>(function TouchSelect(
  { label, options, hint, error, placeholder, className = '', id, ...rest },
  ref
) {
  const inputId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
        {rest.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          className={`
            w-full appearance-none rounded-xl border px-4 pr-10 text-base text-gray-900 bg-white
            min-h-[44px] transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            touch-manipulation
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}
            ${className}
          `}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {hint && !error && <p id={hintId} className="text-xs text-gray-500">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
});

export default TouchSelect;
