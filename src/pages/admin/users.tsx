import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { userAPI } from '@/lib/api/userAPI';
import styles from '@/styles/pages/AdminUsers.module.css';

const ROLES = ['user', 'admin', 'vet', 'clinic_staff'] as const;
type Role = (typeof ROLES)[number];

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{ userId: string; role: Role } | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await (userAPI as unknown as {
        listAdminUsers: (opts: { page: number; limit: number }) => Promise<{ items: AdminUser[]; total: number }>;
      }).listAdminUsers({ page: p, limit: PAGE_SIZE });
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const handleRoleChange = (userId: string, role: Role) => {
    setPendingRole({ userId, role });
  };

  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    setSaving(true);
    try {
      await (userAPI as unknown as {
        updateUserRole: (id: string, role: Role) => Promise<void>;
      }).updateUserRole(pendingRole.userId, pendingRole.role);
      setUsers((prev) =>
        prev.map((u) => (u.id === pendingRole.userId ? { ...u, role: pendingRole.role } : u)),
      );
    } catch {
      setError('Failed to update role. Please try again.');
    } finally {
      setSaving(false);
      setPendingRole(null);
    }
  };

  return (
    <>
      <Head>
        <title>User Management — Admin — PetChain</title>
      </Head>
      <div className={styles.container}>
        <h1 className={styles.heading}>User Management</h1>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p className={styles.loading}>Loading users…</p>
        ) : (
          <>
            <table className={styles.table} aria-label="Users">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        aria-label={`Role for ${u.fullName}`}
                        className={styles.roleSelect}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  ← Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Role-change confirmation dialog (issue #1389) */}
      {pendingRole && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-label="Confirm role change">
          <div className={styles.dialog}>
            <p className={styles.dialogText}>
              Change{' '}
              <strong>{users.find((u) => u.id === pendingRole.userId)?.fullName ?? 'this user'}</strong>
              's role to <strong>{pendingRole.role}</strong>?
            </p>
            <div className={styles.dialogActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setPendingRole(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={confirmRoleChange}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
