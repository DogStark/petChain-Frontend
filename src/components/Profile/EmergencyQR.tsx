import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, ExternalLink } from 'lucide-react';

interface EmergencyQRProps {
    petId: string;
    petName: string;
}

export const EmergencyQR: React.FC<EmergencyQRProps> = ({ petId, petName }) => {
    const emergencyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pets/${petId}/emergency`;

    const downloadQR = () => {
        const svg = document.querySelector(`#qr-${petId}`);
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");
        const img: HTMLImageElement = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile: string = canvas.toDataURL("image/png");
            const downloadLink: HTMLAnchorElement = document.createElement("a");
            downloadLink.download = `${petName}-emergency-qr.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-red-100 flex flex-col items-center gap-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Emergency Access QR</h3>
                <p className="text-sm text-gray-500">Scan to view {petName}&apos;s emergency records instantly</p>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
                <QRCodeSVG
                    id={`qr-${petId}`}
                    value={emergencyUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                        src: "/PETCHAIN.jpeg",
                        x: undefined,
                        y: undefined,
                        height: 40,
                        width: 40,
                        excavate: true,
                    }}
                />
            </div>

            <div className="flex gap-3 w-full">
                <button
                    onClick={downloadQR}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-full py-3 text-sm font-semibold hover:bg-gray-800 transition-all"
                >
                    <Download size={16} /> Download
                </button>
                <a
                    href={emergencyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 rounded-full px-6 py-3 text-sm font-semibold hover:bg-red-100 transition-all"
                >
                    <ExternalLink size={16} /> Preview
                </a>
            </div>

            <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <Share2 size={12} /> Share this link with pet sitters or family
            </div>
        </div>
    );
};
