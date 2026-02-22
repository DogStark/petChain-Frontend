import React, { useState } from "react";
import { UploadCloud, File, X, CheckCircle2 } from "lucide-react";

interface UploadModalProps {
  onClose: () => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    setIsUploading(true);
    // Simulate upload delay
    setTimeout(() => {
      setIsUploading(false);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-blue-900 mb-2">
          Upload Results
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          Upload your pet&apos;s official lab report PDF to automatically
          extract and store results securely.
        </p>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
            <p className="text-lg font-semibold text-green-700">
              Upload Successful!
            </p>
            <p className="text-sm text-gray-500 mt-2">Processing document...</p>
          </div>
        ) : (
          <>
            <form
              onDragEnter={handleDrag}
              onSubmit={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                id="file-upload"
                onChange={handleChange}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center h-full"
              >
                {file ? (
                  <div className="flex items-center gap-3 text-blue-700">
                    <File className="w-8 h-8" />
                    <span className="font-medium truncate max-w-[200px]">
                      {file.name}
                    </span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-12 h-12 text-blue-400 mb-4" />
                    <p className="text-gray-700 font-medium mb-1">
                      Drag & drop your PDF here
                    </p>
                    <p className="text-gray-500 text-sm">
                      or click to browse files
                    </p>
                  </>
                )}
              </label>

              {dragActive && (
                <div
                  className="absolute inset-0 rounded-2xl"
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                />
              )}
            </form>

            <button
              disabled={!file || isUploading}
              onClick={handleUpload}
              className={`w-full mt-6 py-3 rounded-full font-bold text-white transition-all shadow-md ${
                !file || isUploading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
              }`}
            >
              {isUploading ? "Uploading..." : "Confirm Upload"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
