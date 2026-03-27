import React, { useState, useEffect } from 'react';
import styles from './AccountSettings.module.css';
import { ActivityLog } from '../../lib/api/userAPI';

interface Session {
  id: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt?: string;
  isActive: boolean;
}

interface AccountSettingsProps {
  sessions?: Session[];
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeOtherSessions: (currentSessionId: string) => Promise<void>;
  onDeactivateAccount: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onExportData: () => Promise<void>;
  onRequestErasure?: () => Promise<void>;
  onAcceptPolicy?: () => Promise<void>;
  complianceActivities?: ActivityLog[];
  isLoading?: boolean;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  sessions = [],
  onRevokeSession,
  onRevokeOtherSessions,
  onDeactivateAccount,
  onDeleteAccount,
  onExportData,
  onRequestErasure,
  onAcceptPolicy,
  complianceActivities = [],
  isLoading = false,
}) => {
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleRevokeSession = async (sessionId: string) => {
    setIsSubmitting(true);
    try {
      await onRevokeSession(sessionId);
      setSuccessMessage('Session revoked successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to revoke session', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeOthers = async () => {
    const currentSession = sessions.find((s) => s.isActive);
    if (!currentSession) return;

    setIsSubmitting(true);
    try {
      await onRevokeOtherSessions(currentSession.id);
      setSuccessMessage('All other sessions revoked');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to revoke other sessions', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    try {
      await onDeactivateAccount();
      setSuccessMessage('Account deactivated. You will be logged out.');
      setTimeout(() => {
        // Redirect to login page
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      console.error('Failed to deactivate account', error);
    } finally {
      setIsSubmitting(false);
      setShowDeactivateModal(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation.toLowerCase() !== 'delete my account') {
      return;
    }

    setIsSubmitting(true);
    try {
      await onDeleteAccount();
      setSuccessMessage('Account deleted. Redirecting to home page...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Failed to delete account', error);
    } finally {
      setIsSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const handleExportData = async () => {
    setIsSubmitting(true);
    try {
      await onExportData();
      setSuccessMessage('Data export started. Check your email for the download link.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Failed to export data', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestErasure = async () => {
    if (!onRequestErasure) return;
    setIsSubmitting(true);
    try {
      await onRequestErasure();
      setSuccessMessage(
        'Data erasure request processed. Your data will be removed following retention policy.'
      );
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Failed to request data erasure', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptPolicy = async () => {
    if (!onAcceptPolicy) return;
    setIsSubmitting(true);
    try {
      await onAcceptPolicy();
      setSuccessMessage('Privacy and compliance consent recorded successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Failed to record policy consent', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseDeviceInfo = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  const getDeviceName = (session: Session) => {
    return session.deviceName || parseDeviceInfo(session.userAgent);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Sessions Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active Sessions</h2>
          <p className={styles.sectionDescription}>
            Manage your active login sessions across different devices.
          </p>

          {sessions.length > 0 ? (
            <>
              <div className={styles.sessionsList}>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`${styles.sessionItem} ${session.isActive ? styles.active : ''}`}
                  >
                    <div className={styles.sessionInfo}>
                      <div className={styles.deviceName}>
                        {getDeviceName(session)}
                        {!session.isActive && <span className={styles.badge}>Revoked</span>}
                      </div>
                      <div className={styles.sessionDetails}>
                        <span>{session.ipAddress}</span>
                        <span> • Created {new Date(session.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {session.isActive && (
                      <button
                        className={styles.revokeBtn}
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={isSubmitting || isLoading}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {sessions.filter((s) => s.isActive).length > 1 && (
                <button
                  className={styles.revokeOthersBtn}
                  onClick={handleRevokeOthers}
                  disabled={isSubmitting || isLoading}
                >
                  Revoke All Other Sessions
                </button>
              )}
            </>
          ) : (
            <p className={styles.emptyState}>No active sessions</p>
          )}
        </section>

        {/* Data Export Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Download Your Data</h2>
          <p className={styles.sectionDescription}>
            Download a copy of your personal data in a portable format (GDPR compliant).
          </p>

          <button
            className={styles.actionBtn}
            onClick={handleExportData}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? 'Exporting...' : 'Export My Data'}
          </button>
        </section>

        {/* Privacy Policy Consent Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Consent Management</h2>
          <p className={styles.sectionDescription}>
            Record consent for GDPR, CCPA and pet data privacy requirements.
          </p>

          <button
            className={styles.actionBtn}
            onClick={handleAcceptPolicy}
            disabled={isSubmitting || isLoading || !onAcceptPolicy}
          >
            {isSubmitting ? 'Recording...' : 'Accept Privacy & Data Policy'}
          </button>

          <p className={styles.policyText}>
            Your consent is auditable and will be stored in compliance logs.
          </p>

          {complianceActivities && complianceActivities.length > 0 && (
            <div className={styles.complianceLog}>
              <h4 className={styles.sectionTitle}>Compliance Audit Trail</h4>
              <ul>
                {complianceActivities.slice(0, 6).map((activity) => (
                  <li key={activity.id}>
                    <strong>{activity.activityType}</strong> -{' '}
                    {new Date(activity.createdAt).toLocaleString()} - {activity.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Data Erasure (Right to be Forgot) Section */}
        <section className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>Right to be Forgotten</h2>
          <p className={styles.sectionDescription}>
            Request that your personal and pet data be erased in accordance with GDPR/CCPA. Data is
            retained for 30 days before permanent removal to support recovery requests.
          </p>

          <button
            className={styles.dangerBtn}
            onClick={handleRequestErasure}
            disabled={isSubmitting || isLoading || !onRequestErasure}
          >
            {isSubmitting ? 'Processing...' : 'Request Data Erasure'}
          </button>
        </section>

        {/* Deactivate Account Section */}
        <section className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>Deactivate Account</h2>
          <p className={styles.sectionDescription}>
            Temporarily disable your account. Your data will be preserved and you can reactivate
            anytime.
          </p>

          <button
            className={styles.dangerBtn}
            onClick={() => setShowDeactivateModal(true)}
            disabled={isSubmitting || isLoading}
          >
            Deactivate Account
          </button>
        </section>

        {/* Delete Account Section */}
        <section className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>Delete Account</h2>
          <p className={styles.sectionDescription}>
            Permanently delete your account and all associated data. This action cannot be undone.
            Your data will be retained for 30 days as per our privacy policy.
          </p>

          <button
            className={styles.deleteBtn}
            onClick={() => setShowDeleteModal(true)}
            disabled={isSubmitting || isLoading}
          >
            Delete Account Permanently
          </button>
        </section>

        {successMessage && <div className={styles.success}>{successMessage}</div>}
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Deactivate Account?</h3>
            <p>
              Your account will be temporarily disabled. You can reactivate it anytime by logging in
              again.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowDeactivateModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDangerBtn}
                onClick={handleDeactivate}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Delete Account Permanently?</h3>
            <p>
              This action cannot be undone. All your data will be permanently deleted after 30 days.
              You will not be able to log in anymore.
            </p>
            <p className={styles.warning}>Type "delete my account" below to confirm:</p>
            <input
              type="text"
              className={styles.confirmInput}
              placeholder="Type 'delete my account' to confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              disabled={isSubmitting}
            />
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={handleDelete}
                disabled={isSubmitting || deleteConfirmation.toLowerCase() !== 'delete my account'}
              >
                {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
