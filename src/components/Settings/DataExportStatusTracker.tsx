import React, { useState, useEffect, useCallback } from 'react';
import { Download, Clock, CheckCircle, Loader2, AlertCircle, FileDown } from 'lucide-react';
import { gdprService } from '@/lib/gdpr';

type ExportStatus = 'idle' | 'pending' | 'processing' | 'ready' | 'downloaded' | 'failed';

interface ExportRequest {
  id: string;
  status: ExportStatus;
  requestedAt: string;
  expiresAt?: string;
  downloadUrl?: string;
}

interface DataExportStatusTrackerProps {
  userId: string;
}

function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 0) return `Expires in ${diffHours}h ${diffMins}m`;
  return `Expires in ${diffMins}m`;
}

const STATUS_CONFIG: Record<
  ExportStatus,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  idle: {
    label: 'No active request',
    icon: <FileDown size={16} />,
    color: 'text-gray-500',
    description: 'Request a copy of your personal data.',
  },
  pending: {
    label: 'Pending',
    icon: <Clock size={16} className="text-yellow-500" />,
    color: 'text-yellow-600',
    description: 'Your export request is queued for processing.',
  },
  processing: {
    label: 'Processing',
    icon: <Loader2 size={16} className="text-blue-500 animate-spin" />,
    color: 'text-blue-600',
    description: 'Your data is being compiled. This may take a few minutes.',
  },
  ready: {
    label: 'Ready to download',
    icon: <CheckCircle size={16} className="text-green-500" />,
    color: 'text-green-600',
    description: 'Your export is ready. Download it before it expires.',
  },
  downloaded: {
    label: 'Downloaded',
    icon: <CheckCircle size={16} className="text-gray-400" />,
    color: 'text-gray-500',
    description: 'Your data export was downloaded.',
  },
  failed: {
    label: 'Failed',
    icon: <AlertCircle size={16} className="text-red-500" />,
    color: 'text-red-600',
    description: 'Your export request failed. Please try again.',
  },
};

const PROGRESS_STEPS: ExportStatus[] = ['pending', 'processing', 'ready', 'downloaded'];

function ProgressBar({ status }: { status: ExportStatus }) {
  const stepIndex = PROGRESS_STEPS.indexOf(status);
  if (stepIndex < 0) return null;
  const pct = Math.round(((stepIndex + 1) / PROGRESS_STEPS.length) * 100);
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 my-2">
      <div
        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export default function DataExportStatusTracker({ userId }: DataExportStatusTrackerProps) {
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (gdprService as unknown as {
        getExportStatus?: (userId: string) => Promise<ExportRequest | null>;
      }).getExportStatus?.(userId);
      setExportRequest(res ?? null);
    } catch {
      // If the endpoint doesn't exist yet, treat as idle
      setExportRequest(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while pending or processing
  useEffect(() => {
    const status = exportRequest?.status;
    if (status !== 'pending' && status !== 'processing') return;
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, [exportRequest?.status, fetchStatus]);

  const handleRequestExport = async () => {
    setRequesting(true);
    setError(null);
    try {
      await gdprService.exportData(userId);
      // After triggering the export, refetch status
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export request failed');
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async () => {
    if (!exportRequest?.downloadUrl) return;
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = exportRequest.downloadUrl;
      a.download = `petchain-data-${userId}.json`;
      a.click();
      setExportRequest((prev) => prev ? { ...prev, status: 'downloaded' } : prev);
    } finally {
      setDownloading(false);
    }
  };

  const status: ExportStatus = exportRequest?.status ?? 'idle';
  const cfg = STATUS_CONFIG[status];
  const isActive = status === 'pending' || status === 'processing';
  const canRequest = status === 'idle' || status === 'failed' || status === 'downloaded';

  return (
    <section aria-label="Data export status" className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-center gap-2">
        <span className={cfg.color}>{cfg.icon}</span>
        <h3 className="font-medium text-gray-800 text-sm">Data Export</h3>
        {loading && <Loader2 size={12} className="text-gray-400 animate-spin" />}
      </div>

      <div className={`text-sm ${cfg.color} font-medium`}>{cfg.label}</div>
      <p className="text-xs text-gray-500">{cfg.description}</p>

      {isActive && <ProgressBar status={status} />}

      {status === 'ready' && exportRequest?.expiresAt && (
        <p className="text-xs text-amber-600 font-medium">
          {formatExpiry(exportRequest.expiresAt)}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {canRequest && (
          <button
            onClick={handleRequestExport}
            disabled={requesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {requesting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <FileDown size={12} />
            )}
            Request Export
          </button>
        )}

        {status === 'ready' && exportRequest?.downloadUrl && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Download
          </button>
        )}
      </div>
    </section>
  );
}
