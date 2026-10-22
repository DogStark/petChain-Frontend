import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { translateApiError } from '@/lib/apiError';

interface ApiErrorAlertProps {
  error: unknown;
  id?: string;
}

export default function ApiErrorAlert({ error, id }: ApiErrorAlertProps) {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const translatedError = translateApiError(error, t);

  const copyCorrelationId = async () => {
    if (!translatedError.correlationId) return;

    try {
      await navigator.clipboard.writeText(translatedError.correlationId);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <p>{translatedError.message}</p>
      {translatedError.correlationId && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span>{t('errors.api.correlationIdLabel')}:</span>
          <code
            tabIndex={0}
            aria-label={t('errors.api.correlationIdAccessibleLabel')}
            className="select-all rounded bg-white px-1 font-mono"
          >
            {translatedError.correlationId}
          </code>
          <button
            type="button"
            onClick={() => void copyCorrelationId()}
            className="rounded px-2 py-1 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('errors.api.copyCorrelationId')}
          </button>
          {copyStatus !== 'idle' && (
            <span role="status" aria-live="polite">
              {t(
                copyStatus === 'copied'
                  ? 'errors.api.correlationIdCopied'
                  : 'errors.api.correlationIdCopyFailed',
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
