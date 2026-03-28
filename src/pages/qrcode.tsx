import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, RefreshCw, ToggleLeft, ToggleRight,
  BarChart2, Download, ArrowLeft, Plus, AlertCircle
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { qrcodeAPI, QRCodeRecord, ScanAnalytics } from '@/lib/api/qrcodeAPI';
import { GetServerSideProps } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

function QRCard({ qr, onToggle, onRegenerate, onSelect }: {
  qr: QRCodeRecord;
  onToggle: (qr: QRCodeRecord) => void;
  onRegenerate: (qr: QRCodeRecord) => void;
  onSelect: (qr: QRCodeRecord) => void;
}) {
  const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${qr.qrCodeId}`;

  const download = () => {
    const svg = document.getElementById(`qr-svg-${qr.qrCodeId}`);
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `petchain-qr-${qr.qrCodeId}.svg`;
    a.click();
  };

  return (
    <div className={`bg-white rounded-2xl shadow border p-5 flex flex-col gap-4 ${!qr.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400 font-mono truncate max-w-[180px]">{qr.qrCodeId}</p>
          <p className="text-xs text-gray-500 mt-1">Scans: <span className="font-bold text-gray-800">{qr.scanCount}</span></p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${qr.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {qr.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-inner">
          <QRCodeSVG
            id={`qr-svg-${qr.qrCodeId}`}
            value={scanUrl}
            size={140}
            level="H"
            includeMargin
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onToggle(qr)} className="flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-all">
          {qr.isActive ? <ToggleRight size={14} className="text-green-600" /> : <ToggleLeft size={14} />}
          {qr.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={() => onRegenerate(qr)} className="flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-all">
          <RefreshCw size={14} /> Regenerate
        </button>
        <button onClick={download} className="flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-all">
          <Download size={14} /> Download
        </button>
        <button onClick={() => onSelect(qr)} className="flex items-center gap-1 text-xs px-3 py-2 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-all">
          <BarChart2 size={14} /> Analytics
        </button>
      </div>
    </div>
  );
}

function AnalyticsPanel({ qrCodeId, onClose }: { qrCodeId: string; onClose: () => void }) {
  const [analytics, setAnalytics] = useState<ScanAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qrcodeAPI.getAnalytics(qrCodeId)
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, [qrCodeId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><BarChart2 size={20} /> QR Analytics</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-900 border-t-transparent" /></div>
        ) : analytics ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-gray-900">{analytics.totalScans}</p>
              <p className="text-sm text-gray-500">Total Scans</p>
            </div>

            {analytics.scansByDevice.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">By Device</h3>
                <div className="space-y-1">
                  {analytics.scansByDevice.map((d) => (
                    <div key={d.deviceType} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="capitalize">{d.deviceType || 'Unknown'}</span>
                      <span className="font-bold">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics.scansByLocation.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">By Location</h3>
                <div className="space-y-1">
                  {analytics.scansByLocation.map((l) => (
                    <div key={`${l.city}-${l.country}`} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span>{l.city}, {l.country}</span>
                      <span className="font-bold">{l.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics.recentScans.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">Recent Scans</h3>
                <div className="space-y-1">
                  {analytics.recentScans.slice(0, 5).map((s) => (
                    <div key={s.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                      <span>{s.city ? `${s.city}, ${s.country}` : 'Unknown location'}</span>
                      <span>{new Date(s.scannedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No analytics data available.</p>
        )}
      </div>
    </div>
  );
}

export default function QRCodePage() {
  const router = useRouter();
  const { petId } = router.query;

  const [qrcodes, setQrcodes] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);

  const load = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      const data = await qrcodeAPI.getByPetId(pid);
      setQrcodes(data);
    } catch {
      setError('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (petId && typeof petId === 'string') load(petId);
  }, [petId, load]);

  const handleCreate = async () => {
    if (!petId || typeof petId !== 'string') return;
    setCreating(true);
    try {
      const qr = await qrcodeAPI.create(petId);
      setQrcodes((prev) => [qr, ...prev]);
    } catch {
      setError('Failed to create QR code');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (qr: QRCodeRecord) => {
    try {
      const updated = await qrcodeAPI.update(qr.qrCodeId, { isActive: !qr.isActive });
      setQrcodes((prev) => prev.map((q) => q.qrCodeId === qr.qrCodeId ? updated : q));
    } catch {
      setError('Failed to update QR code');
    }
  };

  const handleRegenerate = async (qr: QRCodeRecord) => {
    if (!confirm('Regenerate this QR code? The old code will stop working.')) return;
    try {
      const updated = await qrcodeAPI.regenerate(qr.qrCodeId);
      setQrcodes((prev) => prev.map((q) => q.qrCodeId === qr.qrCodeId ? updated : q));
    } catch {
      setError('Failed to regenerate QR code');
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>QR Code Tags — PetChain</title></Head>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-all">
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black flex items-center gap-2"><QrCode size={24} /> QR Code Tags</h1>
            <button
              onClick={handleCreate}
              disabled={creating || !petId}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-all"
            >
              <Plus size={16} /> {creating ? 'Creating…' : 'New QR Code'}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
              <AlertCircle size={16} /> {error}
              <button onClick={() => setError(null)} className="ml-auto font-bold">×</button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 border-t-transparent" /></div>
          ) : qrcodes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <QrCode size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-semibold">No QR codes yet</p>
              <p className="text-sm mt-1">Create one to generate a scannable pet tag</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {qrcodes.map((qr) => (
                <QRCard
                  key={qr.qrCodeId}
                  qr={qr}
                  onToggle={handleToggle}
                  onRegenerate={handleRegenerate}
                  onSelect={(q) => setSelectedQR(q.qrCodeId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedQR && (
        <AnalyticsPanel qrCodeId={selectedQR} onClose={() => setSelectedQR(null)} />
      )}
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
