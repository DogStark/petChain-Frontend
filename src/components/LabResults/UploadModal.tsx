import React, { useState, useCallback } from 'react';
import { UploadCloud, File, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        setError('Please upload a PDF file.');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        setError('Please upload a PDF file.');
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    // Simulate upload delay and processing
    setTimeout(() => {
      setIsUploading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md relative animate-fade-in"
        role="document"
      >
        <button
          onClick={onClose}
          aria-label="Close upload dialog"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        <h2 id="upload-modal-title" className="text-2xl font-bold text-blue-900 mb-2">
          Upload Results
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Upload your pet&apos;s official lab report PDF to automatically extract and store results
          securely on the blockchain.
        </p>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
            <div className="p-4 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-700">Upload Successful!</p>
            <p className="text-sm text-gray-500 mt-2">
              Our AI is processing your document. Results will appear in your dashboard shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              } ${error ? 'border-red-300 bg-red-50' : ''}`}
            >
              <input
                type="file"
                accept=".pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <div className="flex flex-col items-center justify-center">
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                      <File className="w-10 h-10" />
                    </div>
                    <span className="font-semibold text-blue-900 truncate max-w-[240px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                      <UploadCloud className="w-10 h-10 text-blue-500" />
                    </div>
                    <p className="text-gray-700 font-bold mb-1">Drag & drop your PDF</p>
                    <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
              className={`w-full mt-2 py-4 rounded-2xl font-bold text-white transition-all shadow-md active:scale-[0.98] transform ${
                !selectedFile || isUploading
                  ? 'bg-blue-200 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Confirm & Analyze Report'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
