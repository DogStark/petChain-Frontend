import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Shield, CheckCircle, XCircle } from 'lucide-react';

export interface AdminActionTarget {
  /** Unique identifier loaded from trusted backend data */
  id: string;
  /** Human-readable name (first + last, username, etc.) */
  displayName: string;
  /** Verified email address */
  email?: string;
  /** Role on the platform (e.g. "user", "vet", "admin") */
  role?: string;
}

export interface AdminActionDefinition {
  /** Short machine-readable key (e.g. "delete", "suspend", "verify") */
  type: string;
  /** Human-readable action label shown in the dialog header */
  label: string;
  /** Detailed description of what will happen */
  description: string;
  /** Whether the action is irreversible */
  irreversible?: boolean;
  /** The scope of affected resources or systems */
  scope?: string;
}

export type ConfirmationOutcome = 'confirmed' | 'cancelled' | 'failed';

export interface AuditEvent {
  action: string;
  targetId: string;
  outcome: ConfirmationOutcome;
  timestamp: string;
}

interface AdminConfirmationDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Target loaded from trusted data (API response, not user-supplied) */
  target: AdminActionTarget;
  /** Definition of the action to be performed */
  action: AdminActionDefinition;
  /** Called when the user deliberately confirms */
  onConfirm: () => void | Promise<void>;
  /** Called when the user cancels or dismisses */
  onCancel: () => void;
  /** Optional callback for audit logging (receives no sensitive payload) */
  onAudit?: (event: AuditEvent) => void;
  /** Optional error message to display */
  error?: string | null;
  /** Optional label override for confirm button */
  confirmLabel?: string;
  /** Optional label override for cancel button */
  cancelLabel?: string;
}

/**
 * AdminConfirmationDialog – shared confirmation modal for administrative actions
 * (deletion, suspension, verification, etc.).
 *
 * Security properties:
 *  - Target is loaded from trusted data (the `target` prop) – never from user input.
 *  - Confirmation requires deliberate action: the user must type the target's
 *    display name before the confirm button becomes enabled.
 *  - The confirm button is debounced to prevent accidental double-trigger.
 *  - Audit callbacks fire without sensitive payloads.
 */
export default function AdminConfirmationDialog({
  open,
  target,
  action,
  onConfirm,
  onCancel,
  onAudit,
  error: externalError,
  confirmLabel = `Yes, ${action.label}`,
  cancelLabel = 'Cancel',
}: AdminConfirmationDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [confirmedOnce, setConfirmedOnce] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const recentClickRef = useRef<number>(0);
  const processingRef = useRef(false);

  const error = externalError ?? internalError;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setConfirmationText('');
      setIsProcessing(false);
      setInternalError(null);
      setConfirmedOnce(false);
      processingRef.current = false;
    }
  }, [open]);

  // Focus management
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    // Focus the confirmation text input on open
    const input = dialogRef.current?.querySelector<HTMLInputElement>('input');
    requestAnimationFrame(() => {
      input?.focus();
    });
    return () => {
      previousFocus?.focus();
    };
  }, [open]);

  // Escape to cancel
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!processingRef.current) {
          onCancel();
          onAudit?.({
            action: action.type,
            targetId: target.id,
            outcome: 'cancelled',
            timestamp: new Date().toISOString(),
          });
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel, onAudit, action.type, target.id]);

  const matchesTarget = confirmationText.trim() === target.displayName;

  const handleConfirm = useCallback(async () => {
    // Debounce: ignore clicks that occur within 500ms of the last one
    const now = Date.now();
    if (now - recentClickRef.current < 500) return;
    recentClickRef.current = now;

    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setInternalError(null);

    try {
      await onConfirm();
      setConfirmedOnce(true);
      onAudit?.({
        action: action.type,
        targetId: target.id,
        outcome: 'confirmed',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setInternalError(message);
      onAudit?.({
        action: action.type,
        targetId: target.id,
        outcome: 'failed',
        timestamp: new Date().toISOString(),
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [onConfirm, onAudit, action.type, target.id]);

  const handleCancel = useCallback(() => {
    if (processingRef.current) return;
    onCancel();
    onAudit?.({
      action: action.type,
      targetId: target.id,
      outcome: 'cancelled',
      timestamp: new Date().toISOString(),
    });
  }, [onCancel, onAudit, action.type, target.id]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !processingRef.current) {
        handleCancel();
      }
    },
    [handleCancel]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-description"
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-red-200"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="admin-confirm-title"
                className="text-lg font-bold text-red-800"
              >
                {action.label}
              </h2>
              <p
                id="admin-confirm-description"
                className="text-sm text-gray-600 mt-1"
              >
                {action.description}
              </p>
            </div>
          </div>

          {/* Target information — loaded from trusted data */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Target
            </h3>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-900">{target.displayName}</span>
            </div>
            {target.email && (
              <p className="text-sm text-gray-600 ml-6">{target.email}</p>
            )}
            {target.role && (
              <div className="flex items-center gap-2 ml-6">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {target.role}
                </span>
                <span className="text-xs text-gray-400">ID: {target.id}</span>
              </div>
            )}
          </div>

          {/* Scope and effects */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
              Scope &amp; Effects
            </h3>
            {action.scope && (
              <p className="text-sm text-amber-900 mb-2">{action.scope}</p>
            )}
            {action.irreversible && (
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">This action is irreversible.</span>
              </div>
            )}
          </div>

          {/* Deliberate confirmation — type the target name */}
          <div className="mb-4">
            <label
              htmlFor="admin-confirm-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type <span className="font-bold text-red-600">{target.displayName}</span> to confirm
            </label>
            <input
              id="admin-confirm-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={`Type "${target.displayName}" to confirm`}
              disabled={isProcessing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:bg-gray-100"
              aria-describedby="admin-confirm-input-hint"
            />
            <p
              id="admin-confirm-input-hint"
              className="text-xs text-gray-500 mt-1"
            >
              This prevents accidental confirmation from keyboard timing or rapid clicking.
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2"
            >
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success display */}
          {confirmedOnce && (
            <div
              role="status"
              className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-2"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Action completed successfully.</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={!matchesTarget || isProcessing}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${
              matchesTarget && !isProcessing
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-red-300 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
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