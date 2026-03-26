import { forwardRef } from 'react';

interface TouchTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

const TouchTextarea = forwardRef<HTMLTextAreaElement, TouchTextareaProps>(function TouchTextarea(
  { label, hint, error, className = '', id, ...rest },
  ref
) {
  const inputId = id ?? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
        {rest.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <textarea
        ref={ref}
        id={inputId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={!!error}
        rows={rest.rows ?? 3}
        className={`
          w-full rounded-xl border px-4 py-3 text-base text-gray-900 bg-white
          min-h-[88px] resize-y transition-all duration-150
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          touch-manipulation
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}
          ${className}
        `}
        {...rest}
      />

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

export default TouchTextarea;
