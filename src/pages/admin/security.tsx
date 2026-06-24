import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { Shield, AlertTriangle, Activity, Users, Clock, CheckCircle, XCircle, Home, Settings, LogOut } from 'lucide-react';

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  blockedRequests: number;
  activeBlacklistedIPs: number;
  recentThreats: SecurityEvent[];
  threatTrends: Array<{
    period: string;
    events: number;
    blocked: number;
  }>;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  ipAddress: string;
  userId?: string;
  description: string;
  blocked: boolean;
  timestamp: string;
}

interface RealTimeAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export default function SecurityDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<RealTimeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [activeTab, setActiveTab] = useState('events');

  useEffect(() => {
    fetchSecurityData();
    // Set up real-time updates
    const interval = setInterval(fetchSecurityData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchSecurityData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch(`/api/security/metrics?timeRange=${timeRange}`, {
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch('/api/security/alerts', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/security/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setAlerts(alerts.map(alert =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high': return <XCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
                  PetChain
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                  <Home className="h-5 w-5" />
                </Link>
                <Link href="/settings" className="text-gray-700 hover:text-gray-900">
                  <Settings className="h-5 w-5" />
                </Link>
                <button className="text-red-600 hover:text-red-500">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
                PetChain
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900 flex items-center space-x-1">
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <Link href="/settings" className="text-gray-700 hover:text-gray-900 flex items-center space-x-1">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
              <button className="text-red-600 hover:text-red-500 flex items-center space-x-1">
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
              <p className="text-gray-600">Monitor and manage security threats in real-time</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              className={`px-4 py-2 rounded ${timeRange === '1h' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTimeRange('1h')}
            >
              1H
            </button>
            <button
              className={`px-4 py-2 rounded ${timeRange === '24h' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTimeRange('24h')}
            >
              24H
            </button>
            <button
              className={`px-4 py-2 rounded ${timeRange === '7d' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setTimeRange('7d')}
            >
              7D
            </button>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Active Alerts ({alerts.length})
            </h2>
            <div className="space-y-4">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="border-l-4 border-l-red-500 bg-red-50 p-4 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <p className="font-medium text-red-800">{alert.message}</p>
                        <p className="text-sm text-red-600 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.totalEvents || 0}</p>
                <p className="text-xs text-gray-500">Security events in last {timeRange}</p>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Blocked Requests</p>
                <p className="text-2xl font-bold text-red-600">{metrics?.blockedRequests || 0}</p>
                <p className="text-xs text-gray-500">Malicious requests blocked</p>
              </div>
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Blacklisted IPs</p>
                <p className="text-2xl font-bold text-orange-600">{metrics?.activeBlacklistedIPs || 0}</p>
                <p className="text-xs text-gray-500">Currently blocked IP addresses</p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold text-yellow-600">{alerts.length}</p>
                <p className="text-xs text-gray-500">Unacknowledged security alerts</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'events'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('events')}
              >
                Recent Events
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'threats'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('threats')}
              >
                Threat Analysis
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'trends'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('trends')}
              >
                Trends
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'events' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Recent Security Events</h3>
                <div className="space-y-4">
                  {metrics?.recentThreats?.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <span className={`px-2 py-1 text-xs font-medium text-white rounded ${getSeverityColor(event.severity)}`}>
                          {event.severity}
                        </span>
                        <div>
                          <p className="font-medium">{event.type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-600">{event.description}</p>
                          <p className="text-xs text-gray-500">
                            {event.ipAddress} • {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {event.blocked && (
                        <span className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded">
                          Blocked
                        </span>
                      )}
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-8">No recent security events</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'threats' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Events by Type</h3>
                  <div className="space-y-2">
                    {Object.entries(metrics?.eventsByType || {}).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">{type.replace(/_/g, ' ')}</span>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Events by Severity</h3>
                  <div className="space-y-2">
                    {Object.entries(metrics?.eventsBySeverity || {}).map(([severity, count]) => (
                      <div key={severity} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm capitalize">{severity}</span>
                        <span className={`px-2 py-1 text-xs font-medium text-white rounded ${getSeverityColor(severity)}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Threat Trends</h3>
                <div className="space-y-4">
                  {metrics?.threatTrends?.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(trend.period).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex space-x-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold">{trend.events}</p>
                          <p className="text-xs text-gray-500">Events</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-red-600">{trend.blocked}</p>
                          <p className="text-xs text-gray-500">Blocked</p>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-500 text-center py-8">No trend data available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {},
  };
};