import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, UserSession } from '../lib/api/userAPI';
import { GetServerSideProps } from 'next';

export const dynamic = 'force-dynamic';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    }
  }, [isAuthenticated]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionsData = await userAPI.getAllSessions();
      setSessions(sessionsData);
      const activeSessions = sessionsData.filter((s) => s.isActive);
      if (activeSessions.length > 0) {
        setCurrentSessionId(activeSessions[0].id);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load sessions';
      setError(errorMsg);
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    const isCurrent = sessionId === currentSessionId;
    const confirmMsg = isCurrent
      ? 'This will log you out of this device. Continue?'
      : 'Are you sure you want to revoke this session?';

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setActionLoading(sessionId);
      setError(null);
      await userAPI.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to revoke session';
      setError(errorMsg);
      console.error('Failed to revoke session:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to log out of all other devices?')) {
      return;
    }

    try {
      setActionLoading('all');
      setError(null);
      if (currentSessionId) {
        await userAPI.revokeOtherSessions(currentSessionId);
        setSessions((prev) => prev.filter((s) => s.id === currentSessionId));
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to revoke sessions';
      setError(errorMsg);
      console.error('Failed to revoke all sessions:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to view your active sessions.</p>
          <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Active Sessions - PetChain</title>
        <meta name="description" content="Manage your active PetChain sessions" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">Active Sessions</h1>
              <p className="text-sm text-gray-600 mt-2">
                Manage devices that are currently logged in to your PetChain account.
              </p>
            </div>

            {error && (
              <div className="p-6 bg-red-50 border-t border-red-200">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2">⏳</div>
                <p className="text-gray-600">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-600">No active sessions found.</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {sessions.map((session) => {
                    const isCurrent = session.id === currentSessionId;
                    const lastActive = session.lastActivityAt
                      ? new Date(session.lastActivityAt).toLocaleDateString()
                      : 'Never';

                    return (
                      <div
                        key={session.id}
                        className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="shrink-0">
                            {isCurrent ? (
                              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold">✓</span>
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-gray-600">📱</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {session.deviceName || 'Unknown Device'}
                              {isCurrent && (
                                <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Current
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-600">{session.ipAddress}</p>
                            <p className="text-xs text-gray-500">Last active: {lastActive}</p>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRevoke(session.id)}
                            disabled={actionLoading === session.id}
                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === session.id ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {sessions.filter((s) => s.id !== currentSessionId && s.isActive).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleRevokeAll}
                      disabled={actionLoading === 'all'}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {actionLoading === 'all' ? 'Revoking...' : 'Log out of all other devices'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      This will log you out of all devices except this one.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
