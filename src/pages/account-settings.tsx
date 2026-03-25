import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AccountSettings } from '../components/Settings/AccountSettings';
import TwoFactorSettings from '../components/Settings/TwoFactorSettings';
import { userAPI, UserSession, ActivityLog } from '../lib/api/userAPI';
import styles from '../styles/pages/AccountSettingsPage.module.css';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [complianceActivities, setComplianceActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const [allSessions, activity] = await Promise.all([
          userAPI.getAllSessions(),
          userAPI.getActivity(20, 0),
        ]);
        setSessions(allSessions);
        setComplianceActivities(activity);
      } catch (err: any) {
        setError(err.message || 'Failed to load sessions and compliance activities');
        if (err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [router]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      await userAPI.revokeSession(sessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, isActive: false } : s,
        ),
      );
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeOtherSessions = async (currentSessionId: string) => {
    try {
      setIsLoading(true);
      await userAPI.revokeOtherSessions(currentSessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.id !== currentSessionId ? { ...s, isActive: false } : s,
        ),
      );
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke other sessions');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateAccount = async () => {
    try {
      setIsLoading(true);
      await userAPI.deactivateAccount();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate account');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsLoading(true);
      await userAPI.deleteAccount();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.exportData();
      // Create a blob from the data and trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `petchain-user-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const mostRecent = await userAPI.getActivity(1, 0);
      setComplianceActivities((prev) => [...mostRecent, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || 'Failed to export data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestErasure = async () => {
    try {
      setIsLoading(true);
      await userAPI.deleteAccount();
      setError(null);
      setComplianceActivities((prev) => [
        {
          id: `erasure-${Date.now()}`,
          userId: sessions[0]?.userId ?? '',
          activityType: 'DATA_ERASURE_REQUESTED',
          description: 'User initiated right-to-be-forgotten erasure request',
          ipAddress: '',
          userAgent: navigator.userAgent,
          deviceId: '',
          metadata: {},
          isSuspicious: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to request data erasure');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptPolicy = async () => {
    try {
      setIsLoading(true);
      await userAPI.updatePreferences({ dataShareConsent: true });
      setError(null);
      const mostRecent = await userAPI.getActivity(1, 0);
      setComplianceActivities((prev) => [...mostRecent, ...prev].slice(0, 10));
    } catch (err: any) {
      setError(err.message || 'Failed to accept policy consent');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && sessions.length === 0) {
    return <div className={styles.loading}>Loading account settings...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Account Settings</h1>
        <p>Manage your account security, sessions, and data</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <AccountSettings
        sessions={sessions}
        onRevokeSession={handleRevokeSession}
        onRevokeOtherSessions={handleRevokeOtherSessions}
        onDeactivateAccount={handleDeactivateAccount}
        onDeleteAccount={handleDeleteAccount}
        onExportData={handleExportData}
        onRequestErasure={handleRequestErasure}
        onAcceptPolicy={handleAcceptPolicy}
        complianceActivities={complianceActivities}
        isLoading={isLoading}
      />
      
      <div className={styles.section}>
        <TwoFactorSettings />
      </div>
    </div>
  );
}
