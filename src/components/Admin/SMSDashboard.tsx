import React, { useState, useEffect } from 'react';
import { userAPI } from '../../lib/api/userAPI';
import styles from './SMSDashboard.module.css';

interface GlobalStats {
  sent: number;
  delivered: number;
  failed: number;
  costCents: number;
  limitCents: number | null;
}

interface UserStats {
  userId: string;
  sent: number;
  delivered: number;
  failed: number;
  costCents: number;
  limitCents: number | null;
}

interface AdminSMSStats {
  global: GlobalStats;
  byUser: UserStats[];
}

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

export const SMSDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminSMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userAPI.getAdminSMSStats(month, year);
      setStats(data);
    } catch (err: any) {
      setError(err.response?.status === 403 ? 'Admin access required' : err.message || 'Failed to load SMS stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [month, year]);

  if (loading && !stats) {
    return <div className={styles.loading}>Loading SMS dashboard...</div>;
  }

  if (error && !stats) {
    return <div className={styles.error}>{error}</div>;
  }

  const g = stats?.global;
  const successRate = g && g.sent > 0 ? ((g.delivered / g.sent) * 100).toFixed(1) : '0';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>SMS Usage & Cost</h1>
        <p className={styles.description}>
          Monthly SMS delivery and spending. Configure Twilio and enable SMS in backend to send alerts.
        </p>
        <div className={styles.filters}>
          <label>
            <span className={styles.label}>Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className={styles.select}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={styles.label}>Year</span>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className={styles.select}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={fetchStats} className={styles.refresh}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {stats && (
        <>
          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Sent</div>
              <div className={styles.cardValue}>{g?.sent ?? 0}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Delivered</div>
              <div className={styles.cardValue}>{g?.delivered ?? 0}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Failed</div>
              <div className={styles.cardValue}>{g?.failed ?? 0}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Delivery rate</div>
              <div className={styles.cardValue}>{successRate}%</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Cost</div>
              <div className={styles.cardValue}>
                ${((g?.costCents ?? 0) / 100).toFixed(2)}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Limit</div>
              <div className={styles.cardValue}>
                {g?.limitCents != null ? `$${(g.limitCents / 100).toFixed(2)}` : '—'}
              </div>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>By user</h2>
            {stats.byUser.length === 0 ? (
              <p className={styles.empty}>No SMS usage this period.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Sent</th>
                      <th>Delivered</th>
                      <th>Failed</th>
                      <th>Cost</th>
                      <th>Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.map((u) => (
                      <tr key={u.userId}>
                        <td className={styles.userId}>{u.userId}</td>
                        <td>{u.sent}</td>
                        <td>{u.delivered}</td>
                        <td>{u.failed}</td>
                        <td>${(u.costCents / 100).toFixed(2)}</td>
                        <td>{u.limitCents != null ? `$${(u.limitCents / 100).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
