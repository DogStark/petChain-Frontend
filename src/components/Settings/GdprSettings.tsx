import { useState } from 'react';
import { useGdpr } from '@/hooks/useGdpr';
import type { ConsentType } from '@/lib/gdpr';

interface GdprSettingsProps {
  userId: string;
}

const CONSENT_LABELS: Record<ConsentType, { label: string; description: string }> = {
  essential: {
    label: 'Essential',
    description: 'Required for core functionality. Cannot be disabled.',
  },
  analytics: {
    label: 'Analytics',
    description: 'Help us improve PetChain by sharing anonymous usage data.',
  },
  marketing: {
    label: 'Marketing',
    description: 'Receive personalised tips, offers, and news about PetChain.',
  },
  data_sharing: {
    label: 'Data Sharing',
    description: 'Allow sharing anonymised data with trusted veterinary research partners.',
  },
};

export default function GdprSettings({ userId }: GdprSettingsProps) {
  const { consents, loading, error, updateConsent, exportData, requestDeletion } =
    useGdpr(userId);
  const [deletionReason, setDeletionReason] = useState('');
  const [showDeletionForm, setShowDeletionForm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleToggle = async (type: ConsentType, granted: boolean) => {
    if (type === 'essential') return; // essential consent is immutable
    await updateConsent(type, granted);
  };

  const handleExport = async () => {
    await exportData();
    setActionFeedback('Your data export has started. The download will begin shortly.');
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleDeletionRequest = async () => {
    const result = await requestDeletion(deletionReason || undefined);
    if (result) {
      setShowDeletionForm(false);
      setDeletionReason('');
      setActionFeedback(`Deletion request submitted (ID: ${result.id}). Status: ${result.status}.`);
      setTimeout(() => setActionFeedback(null), 8000);
    }
  };

  return (
    <section aria-labelledby="gdpr-heading">
      <h2 id="gdpr-heading" className="text-lg font-semibold text-gray-900 mb-1">
        Privacy &amp; Data Rights
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Manage your GDPR consent preferences and exercise your data rights.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-3">
          {error}
        </p>
      )}

      {actionFeedback && (
        <p role="status" className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
          {actionFeedback}
        </p>
      )}

      {/* Consent toggles */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg mb-4">
        {(Object.keys(CONSENT_LABELS) as ConsentType[]).map((type) => {
          const consent = consents.find((c) => c.type === type);
          const isEssential = type === 'essential';
          const checked = isEssential ? true : (consent?.granted ?? false);

          return (
            <div key={type} className="flex items-start justify-between px-4 py-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {CONSENT_LABELS[type].label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{CONSENT_LABELS[type].description}</p>
              </div>
              <button
                role="switch"
                aria-checked={checked}
                aria-label={`${CONSENT_LABELS[type].label} consent`}
                disabled={isEssential || loading}
                onClick={() => handleToggle(type, !checked)}
                className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  checked ? 'bg-blue-600' : 'bg-gray-300'
                } ${isEssential ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Data rights actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          Export My Data
        </button>
        <button
          onClick={() => setShowDeletionForm((v) => !v)}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          Request Account Erasure
        </button>
      </div>

      {showDeletionForm && (
        <div className="mt-3 p-4 border border-red-200 rounded-lg bg-red-50">
          <p className="text-sm text-red-800 font-medium mb-2">
            This will permanently delete your account and all associated data. This action cannot
            be undone.
          </p>
          <textarea
            value={deletionReason}
            onChange={(e) => setDeletionReason(e.target.value)}
            placeholder="Optional: reason for erasure request"
            rows={3}
            className="w-full text-sm px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeletionRequest}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Confirm Erasure Request
            </button>
            <button
              onClick={() => setShowDeletionForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
