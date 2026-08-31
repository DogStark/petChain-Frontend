import React, { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, X, Info } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: "danger" | "warning" | "info";
  details?: { label: string; value: string; highlight?: boolean }[];
  riskCues?: string[];
  network?: string;
  fee?: string;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  variant = "danger",
  details = [],
  riskCues = [],
  network,
  fee,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const variantStyles = {
    danger: {
      icon: "text-red-500",
      iconBg: "bg-red-50",
      confirmBtn: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
      border: "border-red-200",
      title: "text-red-800",
    },
    warning: {
      icon: "text-amber-500",
      iconBg: "bg-amber-50",
      confirmBtn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
      border: "border-amber-200",
      title: "text-amber-800",
    },
    info: {
      icon: "text-blue-500",
      iconBg: "bg-blue-50",
      confirmBtn: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
      border: "border-blue-200",
      title: "text-blue-800",
    },
  };

  const styles = variantStyles[variant];

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  const trapFocus = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [getFocusableElements]
  );

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        confirmButtonRef.current?.focus();
      });
    } else {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      trapFocus(e);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel, trapFocus]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border ${styles.border}`}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}
            >
              <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="dialog-title"
                className={`text-lg font-bold ${styles.title}`}
              >
                {title}
              </h2>
              <p
                id="dialog-description"
                className="text-sm text-gray-600 mt-1"
              >
                {description}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Close dialog"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {(network || fee) && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              {network && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Network</span>
                  <span className="font-medium text-gray-900">{network}</span>
                </div>
              )}
              {fee && (
                <div className="flex justify-between py-1 border-t border-gray-100 mt-1">
                  <span className="text-gray-500">Estimated Fee</span>
                  <span className="font-medium text-gray-900">{fee}</span>
                </div>
              )}
            </div>
          )}

          {details.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <dl className="space-y-2">
                {details.map((detail, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <dt className="text-gray-500">{detail.label}</dt>
                    <dd
                      className={`font-medium text-right ${
                        detail.highlight ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {riskCues.length > 0 && (
            <div className="mb-4 space-y-2">
              {riskCues.map((cue, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 mt-0.5"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span>{cue}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${styles.confirmBtn}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
