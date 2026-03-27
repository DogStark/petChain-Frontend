'use client';

import { useState } from 'react';
import { useGdpr } from '@/hooks/useGdpr';
import { ConsentType } from '@/lib/gdpr';

const CONSENT_LABELS: Record<
  ConsentType,
  { label: string; description: string; locked?: boolean }
> = {
  essential: {
    label: 'Essential',
    description: 'Required for the service to function.',
    locked: true,
  },
  analytics: { label: 'Analytics', description: 'Help us improve by sharing usage data.' },
  marketing: { label: 'Marketing', description: 'Receive updates and promotional content.' },
  data_sharing: {
    label: 'Data Sharing',
    description: 'Share anonymised data with research partners.',
  },
};

interface Props {
  userId: string;
}

export default function PrivacySettings({ userId }: Props) {
  const { consents, loading, error, updateConsent, exportData, requestDeletion } = useGdpr(userId);
  const [deletionReason, setDeletionReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  const handleDelete = async () => {
    const req = await requestDeletion(deletionReason || undefined);
    if (req) setDeletionRequested(true);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* Consent Management */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Privacy Preferences</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Manage how your data is used. Changes take effect immediately.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2 mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {(Object.keys(CONSENT_LABELS) as ConsentType[]).map((type) => {
            const meta = CONSENT_LABELS[type];
            const consent = consents.find((c) => c.type === type);
            const granted = consent?.granted ?? type === 'essential';

            return (
              <div key={type} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {meta.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{meta.description}</p>
                </div>
                <button
                  disabled={meta.locked || loading}
                  onClick={() => updateConsent(type, !granted)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none
                    ${granted ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
                    ${meta.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label={`Toggle ${meta.label}`}
                >
                  <span
                    className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform
                      ${granted ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Data Portability */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Download Your Data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Export all your data in JSON format (GDPR Article 20).
        </p>
        <button
          onClick={exportData}
          disabled={loading}
          className="py-2 px-4 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? 'Preparing…' : 'Export My Data'}
        </button>
      </section>

      {/* Right to be Forgotten */}
      <section className="rounded-xl border border-red-200 dark:border-red-800 p-5">
        <h2 className="font-semibold text-red-700 dark:text-red-400 mb-1">Delete My Account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Permanently delete your account and all associated data (GDPR Article 17). This cannot be
          undone.
        </p>

        {deletionRequested ? (
          <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded p-3">
            Your deletion request has been submitted. You will receive a confirmation once
            processing is complete.
          </div>
        ) : showDeleteConfirm ? (
          <div className="space-y-3">
            <textarea
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Optional: reason for deletion"
              rows={2}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-gray-800 dark:text-gray-200"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="py-2 px-4 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2 px-4 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="py-2 px-4 text-sm rounded-lg border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Request Account Deletion
          </button>
        )}
      </section>
    </div>
  );
}
