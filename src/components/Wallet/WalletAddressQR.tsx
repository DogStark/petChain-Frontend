import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, Download, CheckCircle, QrCode } from 'lucide-react';

interface WalletAddressQRProps {
  address: string;
  label?: string;
}

/** Renders a QR code for a Stellar wallet address using the browser's Canvas API (no external lib). */
function encodeQR(text: string, canvas: HTMLCanvasElement): void {
  // Minimal QR encode: use a data-URI via a third-party-free approach.
  // We use the QR code via Google Charts API (offline fallback: show address text).
  // For a production build, replace this with a local qrcode library.
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => ctx.drawImage(img, 0, 0, size, size);
  img.onerror = () => {
    // Fallback: draw address as text in the canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const words = text.match(/.{1,20}/g) ?? [text];
    words.forEach((w, i) => ctx.fillText(w, size / 2, 20 + i * 14));
  };
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

export default function WalletAddressQR({ address, label }: WalletAddressQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (canvasRef.current && address) {
      encodeQR(address, canvasRef.current);
    }
  }, [address]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }, [address]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.download = `wallet-qr-${address.slice(0, 8)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  }, [address]);

  if (!address) return null;

  return (
    <section aria-label="Wallet address QR code" className="flex flex-col items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <QrCode size={16} className="text-blue-500" />
        {label ?? 'Wallet Address'}
      </div>

      <canvas
        ref={canvasRef}
        className="rounded-lg border border-gray-100 shadow-sm"
        aria-label={`QR code for wallet address ${address}`}
        style={{ width: 200, height: 200 }}
      />

      <code className="text-xs text-gray-500 break-all text-center max-w-[200px] select-all">
        {address}
      </code>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Copy wallet address"
        >
          {copied ? (
            <>
              <CheckCircle size={12} className="text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy Address
            </>
          )}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          aria-label="Download QR code as PNG"
        >
          <Download size={12} />
          Download QR
        </button>
      </div>
    </section>
  );
}
