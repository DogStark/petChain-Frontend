import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, ActivityLog } from '../lib/api/userAPI';
import styles from '../styles/pages/ActivityLogPage.module.css';

export const dynamic = 'force-dynamic';

const ACTION_TYPES = [
  'all',
  'login',
  'logout',
  'password_change',
  'profile_update',
  'pet_create',
  'pet_update',
  'pet_delete',
  'appointment_create',
  'appointment_update',
  'medical_record_create',
  'file_upload',
  'session_revoke',
  'two_factor_enable',
  'two_factor_disable',
  'account_deactivate',
  'data_export',
];

const ACTION_ICONS: Record<string, string> = {
  login: '🔐',
  logout: '🚪',
  password_change: '🔑',
  profile_update: '✏️',
  pet_create: '🐾',
  pet_update: '🐾',
  pet_delete: '🗑️',
  appointment_create: '📅',
  appointment_update: '📅',
  medical_record_create: '📋',
  file_upload: '📎',
  session_revoke: '🛡️',
  two_factor_enable: '🔒',
  two_factor_disable: '🔓',
  account_deactivate: '⚠️',
  data_export: '📤',
};

const RETENTION_DAYS = 90;

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isWithinRetention(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff <= RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export default function ActivityLogPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const loadLogs = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);
        const currentOffset = reset ? 0 : offset;
        const data = await userAPI.getActivity(
          LIMIT,
          currentOffset,
          filter === 'all' ? undefined : filter
        );
        const retained = data.filter((l) => isWithinRetention(l.createdAt));
        if (reset) {
          setLogs(retained);
          setOffset(LIMIT);
        } else {
          setLogs((prev) => [...prev, ...retained]);
          setOffset((prev) => prev + LIMIT);
        }
        setHasMore(data.length === LIMIT);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.push('/login');
          return;
        }
        setError(err?.message || 'Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    },
    [filter, offset, router]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filter]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await userAPI.exportActivityLogs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Activity Log - PetChain</title>
        <meta name="description" content="View your account activity history" />
      </Head>

      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Activity Log</h1>
              <p className={styles.subtitle}>
                Audit trail of your account actions · last {RETENTION_DAYS} days
              </p>
            </div>
            <button
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={exporting || loading}
            >
              {exporting ? 'Exporting…' : '⬇ Export CSV'}
            </button>
          </div>

          {/* Filter bar */}
          <div className={styles.filterBar}>
            {ACTION_TYPES.map((type) => (
              <button
                key={type}
                className={`${styles.filterChip} ${filter === type ? styles.active : ''}`}
                onClick={() => setFilter(type)}
              >
                {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {/* Timeline */}
          <div className={styles.timeline}>
            {logs.length === 0 && !loading && (
              <div className={styles.empty}>No activity found for this filter.</div>
            )}

            {logs.map((log, i) => (
              <div key={log.id} className={styles.entry}>
                <div className={styles.iconCol}>
                  <span className={styles.icon}>{ACTION_ICONS[log.activityType] ?? '📌'}</span>
                  {i < logs.length - 1 && <div className={styles.line} />}
                </div>
                <div className={styles.body}>
                  <div className={styles.entryHeader}>
                    <span className={styles.actionType}>{log.activityType.replace(/_/g, ' ')}</span>
                    {log.isSuspicious && (
                      <span className={styles.suspiciousBadge}>⚠ Suspicious</span>
                    )}
                    <span className={styles.time}>{formatRelativeTime(log.createdAt)}</span>
                  </div>
                  {log.description && <p className={styles.description}>{log.description}</p>}
                  <div className={styles.meta}>
                    {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    {log.deviceId && <span>Device: {log.deviceId}</span>}
                    <span title={new Date(log.createdAt).toLocaleString()}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {loading && <div className={styles.loadingRow}>Loading…</div>}

            {!loading && hasMore && logs.length > 0 && (
              <button className={styles.loadMoreBtn} onClick={() => loadLogs(false)}>
                Load more
              </button>
            )}
          </div>

          <div className={styles.retentionNote}>
            Activity logs are retained for {RETENTION_DAYS} days per our data retention policy.
          </div>

          <div className={styles.backLink}>
            <Link href="/account-settings">← Back to Account Settings</Link>
          </div>
        </div>
      </div>
    </>
  );
}
