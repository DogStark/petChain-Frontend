import React, { useState } from "react";
import { Share2, Link, Mail, CheckCircle2, X } from "lucide-react";

interface ShareModalProps {
  onClose: () => void;
}

export default function ShareModal({ onClose }: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://petchain.app/share/lr_9x8f7a6d");
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-pink-100 text-pink-600 rounded-full">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Share Results</h2>
            <p className="text-sm text-gray-500">
              Securely send these lab results to a vet.
            </p>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-3" />
            <p className="text-lg font-semibold text-green-700">
              Sent Successfully!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              They will receive an email with secure access.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleShare} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-xl leading-5 bg-gray-50 border focus:border-blue-500 focus:bg-white focus:ring-blue-500 transition-colors py-3 sm:text-sm"
                  placeholder="vet@clinic.com"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-colors shadow-md hover:shadow-lg"
              >
                Send Secure Email
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or share via link
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className={`w-full flex items-center justify-center gap-2 py-3 border-2 rounded-xl font-semibold transition-all ${
                linkCopied
                  ? "border-green-500 text-green-600 bg-green-50"
                  : "border-blue-100 text-blue-600 hover:bg-blue-50"
              }`}
            >
              {linkCopied ? (
                <>Copied!</>
              ) : (
                <>
                  <Link className="w-5 h-5" /> Copy Secure Link
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
