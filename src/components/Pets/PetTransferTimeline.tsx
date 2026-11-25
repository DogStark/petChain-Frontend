import React, { useEffect, useState } from 'react';
import { ArrowRight, User, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

export interface TransferRecord {
  id: string;
  petId: string;
  fromOwner: { id: string; firstName: string; lastName: string; email: string } | null;
  toOwner: { id: string; firstName: string; lastName: string; email: string };
  transferredAt: string;
  status: 'completed' | 'pending' | 'reverted';
  notes?: string;
  txHash?: string;
}

interface Props {
  petId: string;
}

const API_BASE_URL = getApiBaseUrl();

export default function PetTransferTimeline({ petId }: Props) {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!petId) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/pets/${petId}/transfers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setRecords([]);
            return;
          }
          throw new Error('Failed to load transfer history');
        }

        const data: TransferRecord[] = await res.json();
        if (!cancelled) setRecords(data);
      } catch (err: unknown) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Failed to load transfer history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [petId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading transfer history">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200" />
              {i < 2 && <div className="w-0.5 h-10 bg-gray-100 mt-1" />}
            </div>
            <div className="flex-1 pb-6 space-y-1.5">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <AlertCircle size={16} className="flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        <User size={32} className="mx-auto mb-3 text-gray-300" />
        No ownership transfers recorded for this pet.
      </div>
    );
  }

  return (
    <ol className="relative" aria-label="Ownership transfer history">
      {records.map((record, index) => {
        const isLast = index === records.length - 1;
        const date = new Date(record.transferredAt);
        const formattedDate = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const formattedTime = date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });

        const statusConfig = {
          completed: {
            icon: <CheckCircle size={18} className="text-green-500" />,
            bg: 'bg-green-50 border-green-200',
            badge: 'bg-green-100 text-green-700',
            label: 'Completed',
          },
          pending: {
            icon: <Clock size={18} className="text-yellow-500" />,
            bg: 'bg-yellow-50 border-yellow-200',
            badge: 'bg-yellow-100 text-yellow-700',
            label: 'Pending',
          },
          reverted: {
            icon: <AlertCircle size={18} className="text-red-400" />,
            bg: 'bg-red-50 border-red-200',
            badge: 'bg-red-100 text-red-700',
            label: 'Reverted',
          },
        } as const;

        const cfg = statusConfig[record.status] ?? statusConfig.completed;

        return (
          <li key={record.id} className="flex gap-4">
            {/* Connector column */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${cfg.bg}`}
                aria-hidden="true"
              >
                {cfg.icon}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-200 my-1" aria-hidden="true" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
              <div className={`rounded-xl border p-4 ${cfg.bg}`}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700 flex-wrap">
                    {/* From owner */}
                    {record.fromOwner ? (
                      <span className="font-medium text-gray-800">
                        {record.fromOwner.firstName} {record.fromOwner.lastName}
                      </span>
                    ) : (
                      <span className="font-medium text-gray-500 italic">Initial registration</span>
                    )}

                    {record.fromOwner && (
                      <>
                        <ArrowRight size={14} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
                        <span className="font-medium text-gray-800">
                          {record.toOwner.firstName} {record.toOwner.lastName}
                        </span>
                      </>
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}
                    aria-label={`Status: ${cfg.label}`}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Recipient email */}
                <p className="text-xs text-gray-500 mb-2">
                  <span className="font-medium">New owner:</span>{' '}
                  {record.toOwner.email}
                </p>

                {/* Notes */}
                {record.notes && (
                  <p className="text-xs text-gray-600 italic mb-2">&ldquo;{record.notes}&rdquo;</p>
                )}

                {/* Blockchain hash */}
                {record.txHash && (
                  <p className="text-xs font-mono text-gray-400 break-all">
                    Tx: {record.txHash}
                  </p>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <Clock size={11} aria-hidden="true" />
                  <time dateTime={record.transferredAt}>
                    {formattedDate} at {formattedTime}
                  </time>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
