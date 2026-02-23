import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';

interface Session {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

// Mock API calls - replace with actual API integration
const mockFetchSessions = async (): Promise<Session[]> => {
  return [
    {
      id: '1',
      device: 'Chrome on MacOS',
      location: 'Lagos, Nigeria',
      ip: '192.168.1.1',
      lastActive: 'Active now',
      isCurrent: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone 15',
      location: 'Abuja, Nigeria',
      ip: '102.176.54.12',
      lastActive: '4 hours ago',
      isCurrent: false,
    },
    {
      id: '3',
      device: 'Firefox on Windows',
      location: 'London, UK',
      ip: '82.145.21.7',
      lastActive: '2 days ago',
      isCurrent: false,
    },
  ];
};

const mockRevokeSession = async (sessionId: string): Promise<void> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
};

const mockRevokeAllSessions = async (): Promise<void> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    }
  }, [isAuthenticated]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const sessionsData = await mockFetchSessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) {
      return;
    }

    try {
      setActionLoading(sessionId);
      await mockRevokeSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to revoke session:', error);
      alert('Failed to revoke session. Please try again.');
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
      await mockRevokeAllSessions();
      setSessions(sessions.filter((s) => s.isCurrent));
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
      alert('Failed to revoke sessions. Please try again.');
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
          <a href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
            Go to Login
          </a>
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

            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2">⏳</div>
                <p className="text-gray-600">Loading sessions...</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="shrink-0">
                          {session.isCurrent ? (
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
                            {session.device}
                            {session.isCurrent && (
                              <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Current
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {session.location} • {session.ip}
                          </p>
                          <p className="text-xs text-gray-500">
                            Last active: {session.lastActive}
                          </p>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <button
                          onClick={() => handleRevoke(session.id)}
                          disabled={actionLoading === session.id}
                          className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                        >
                          {actionLoading === session.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {sessions.filter(s => !s.isCurrent).length > 1 && (
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

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Session Management | PetChain</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Session Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review and manage your active sessions across all devices.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleRevokeAll}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
            >
              Revoke All Other Sessions
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
          <ul className="divide-y divide-gray-200">
            {sessions.map((session) => (
              <li key={session.id}>
                <div className="px-4 py-5 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      {/* Placeholder for Device Icon */}
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-indigo-600 truncate">
                          {session.device}
                        </p>
                        {session.isCurrent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Current Session
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span className="truncate">{session.location}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span>IP: {session.ip}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span>{session.lastActive}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevoke(session.id)}
                        className="font-medium text-red-600 hover:text-red-500 text-sm"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer/Help Text */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                If you see a device you don't recognize, we recommend changing your password immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}