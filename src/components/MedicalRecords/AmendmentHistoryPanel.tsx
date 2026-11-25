import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Loader2, Clock, User } from 'lucide-react';
import { useMedicalRecordAmendments, RecordAmendment } from '@/hooks/useMedicalRecordAmendments';

interface AmendmentHistoryPanelProps {
  recordId: string;
}

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="mt-3 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
      {diff.split('\n').map((line, i) => (
        <span
          key={i}
          className={
            line.startsWith('+')
              ? 'text-green-700 block'
              : line.startsWith('-')
              ? 'text-red-600 block'
              : 'text-gray-500 block'
          }
        >
          {line}
        </span>
      ))}
    </pre>
  );
}

function AmendmentEntry({ amendment }: { amendment: RecordAmendment }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(amendment.timestamp);

  return (
    <li className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-grow min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{amendment.summary}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {amendment.editorName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <time dateTime={amendment.timestamp}>
                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </span>
          </div>
        </div>
        {amendment.diff && (
          <span className="shrink-0 mt-0.5 text-gray-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        )}
      </button>

      {expanded && amendment.diff && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <DiffView diff={amendment.diff} />
        </div>
      )}
    </li>
  );
}

export default function AmendmentHistoryPanel({ recordId }: AmendmentHistoryPanelProps) {
  const { amendments, loading, error, reload } = useMedicalRecordAmendments(recordId);

  return (
    <section aria-labelledby="amendment-history-heading" className="space-y-4">
      <h3
        id="amendment-history-heading"
        className="text-base font-black text-gray-900 flex items-center gap-2"
      >
        Amendment History
        {amendments.length > 0 && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
            {amendments.length}
          </span>
        )}
      </h3>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading amendment history…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={reload}
            className="ml-auto text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && amendments.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No amendments recorded yet.</p>
      )}

      {amendments.length > 0 && (
        <ol className="space-y-2" aria-label="Amendment timeline">
          {amendments.map((a) => (
            <AmendmentEntry key={a.id} amendment={a} />
          ))}
        </ol>
      )}
    </section>
  );
}
