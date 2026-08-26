import { UploadCloud, File, X, CheckCircle2, AlertCircle } from 'lucide-react';
import React, { useState, useCallback, useId } from 'react';


import {
  validateAttachment,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE_BYTES,
} from '@/utils/attachmentValidation';

interface UploadModalProps {
  onClose: () => void;
}

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

export default function UploadModal({ onClose }: UploadModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable id for the error region so the input can reference it via aria-describedby
  const errorId = useId();

  // ------------------------------------------------------------------
  // File selection handler – shared by click and drag-and-drop
  // ------------------------------------------------------------------
  const handleFile = useCallback((file: File) => {
    setError(null);

    const result = validateAttachment(file);
    if (!result.valid) {
      setError(result.error ?? 'This file cannot be uploaded.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  // ------------------------------------------------------------------
  // Drag handlers
  // ------------------------------------------------------------------
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  // ------------------------------------------------------------------
  // Input change handler
  // ------------------------------------------------------------------
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile],
  );

  // ------------------------------------------------------------------
  // Upload handler (calls the real API in production)
  // ------------------------------------------------------------------
  const handleUpload = useCallback(() => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);

    // Simulate upload delay and processing
    // In production: replace with uploadLabReport(petId, selectedFile)
    setTimeout(() => {
      setIsUploading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1500);
  }, [selectedFile, onClose]);

  // ------------------------------------------------------------------
  // Derived state for dropzone styling
  // ------------------------------------------------------------------
  const dropzoneClass = [
    'relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200',
    isDragActive
      ? 'border-blue-500 bg-blue-50 scale-[1.02]'
      : error
        ? 'border-red-300 bg-red-50'
        : 'border-gray-200 bg-gray-50 hover:bg-gray-100',
  ].join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      aria-describedby={error ? errorId : undefined}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md relative animate-fade-in"
        role="document"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close upload dialog"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        {/* Title */}
        <h2 id="upload-modal-title" className="text-2xl font-bold text-blue-900 mb-2">
          Upload Results
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Upload your pet&apos;s official lab report {ALLOWED_EXTENSIONS_LABEL} to automatically
          extract and store results securely on the blockchain.
          <br />
          <span className="text-gray-400">
            Maximum size: {MAX_FILE_SIZE_MB} MB. Only {ALLOWED_EXTENSIONS_LABEL} files accepted.
          </span>
        </p>

        {isSuccess ? (
          /* ---- Success state ---- */
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
            {/* ---- Drop zone ---- */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={dropzoneClass}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
                onChange={handleFileChange}
                disabled={isUploading}
                aria-label="Select a PDF file to upload"
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? true : undefined}
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
                    <p className="text-gray-700 font-bold mb-1">Drag &amp; drop your PDF</p>
                    <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ---- Accessible error region ---- */}
            {/*
              role="alert" implies aria-live="assertive", which causes
              screen readers to announce the message immediately when it
              appears.  The region is always rendered in the DOM when
              there is an error so the announcement fires correctly.
            */}
            {error && (
              <div
                id={errorId}
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            {/* ---- Submit button ---- */}
            <button
              type="button"
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
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Uploading…</span>
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
