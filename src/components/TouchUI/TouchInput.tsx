import { forwardRef, useState } from 'react';

// Maps semantic field names to the correct mobile input type + inputMode + autocomplete
const INPUT_TYPE_MAP: Record<string, { type: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string }> = {
  email:           { type: 'email',    inputMode: 'email',   autoComplete: 'email' },
  password:        { type: 'password',                       autoComplete: 'current-password' },
  'new-password':  { type: 'password',                       autoComplete: 'new-password' },
  phone:           { type: 'tel',      inputMode: 'tel',     autoComplete: 'tel' },
  number:          { type: 'number',   inputMode: 'numeric' },
  decimal:         { type: 'number',   inputMode: 'decimal' },
  search:          { type: 'search',   inputMode: 'search',  autoComplete: 'off' },
  url:             { type: 'url',      inputMode: 'url' },
  text:            { type: 'text',     inputMode: 'text' },
};

export interface TouchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  /** Semantic field type — drives correct mobile keyboard */
  fieldType?: keyof typeof INPUT_TYPE_MAP;
  /** Show/hide toggle for password fields */
  showPasswordToggle?: boolean;
}

const TouchInput = forwardRef<HTMLInputElement, TouchInputProps>(function TouchInput(
  { label, hint, error, fieldType = 'text', showPasswordToggle, className = '', id, ...rest },
  ref
) {
  const [showPw, setShowPw] = useState(false);
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const isPassword = fieldType === 'password' || fieldType === 'new-password';

  const mapped = INPUT_TYPE_MAP[fieldType] ?? INPUT_TYPE_MAP.text;
  const resolvedType = isPassword && showPw ? 'text' : mapped.type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
        {rest.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          inputMode={mapped.inputMode}
          autoComplete={rest.autoComplete ?? mapped.autoComplete}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          className={`
            w-full rounded-xl border px-4 text-base text-gray-900 bg-white
            min-h-[44px] transition-all duration-150
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            touch-manipulation
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}
            ${isPassword && showPasswordToggle ? 'pr-12' : ''}
            ${className}
          `}
          {...rest}
        />

        {isPassword && showPasswordToggle && (
          <button
            type="button"
            aria-label={showPw ? 'Hide password' : 'Show password'}
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {showPw ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500">{hint}</p>
      )}
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

export default TouchInput;
