// Admin Analytics - Comprehensive Dashboard with Cohort and SLO Metrics
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { getDatabase, getFunctions } from '../../appwrite/client';

interface AnalyticsData {
  overview: {
    totalRecognitions: number;
    verifiedRecognitions: number;
    verificationRate: number;
    avgResponseTime: number;
    activeUsers: number;
  };
  cohortMetrics: {
    month: string;
    newUsers: number;
    retentionRate: number;
    recognitionsPerUser: number;
  }[];
  funnelMetrics: {
    stage: string;
    count: number;
    conversionRate: number;
  }[];
  recognitionDistribution: {
    department: string;
    given: number;
    received: number;
    avgWeight: number;
  }[];
  sloHealth: {
    metric: string;
    current: number;
    target: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    trend: 'UP' | 'DOWN' | 'STABLE';
  }[];
  teamMetrics: {
    teamName: string;
    size: number;
    recognitionVelocity: number;
    engagementScore: number;
    topTags: string[];
  }[];
}

interface FilterState {
  timeRange: '7d' | '30d' | '90d' | '1y';
  team: string;
  role: string;
  department: string;
}

export default function AnalyticsPage(): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const t = useI18n;
  const databases = getDatabase();
  const functions = getFunctions();

  // State management
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cohorts' | 'teams' | 'slo'>('overview');
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    timeRange: '30d',
    team: 'ALL',
    role: 'ALL',
    department: 'ALL'
  });

  // Refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Access control
  if (!currentUser || !hasRole('MANAGER')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">🚫</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Manager access required for analytics dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await functions.createExecution(
        'admin-analytics-dashboard',
        JSON.stringify({ filters })
      );

      const result = JSON.parse(response.responseBody);

      if (result.success) {
        setAnalyticsData(result.data);
        setLastUpdated(new Date());
      } else {
        setError(result.error || 'Failed to load analytics data');
      }

    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, functions]);

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        loadAnalyticsData();
      }, 60000); // Refresh every minute
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadAnalyticsData]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Render SLO status indicator
  const renderSLOStatus = (status: 'HEALTHY' | 'WARNING' | 'CRITICAL') => {
    const colors = {
      HEALTHY: 'bg-green-100 text-green-800 border-green-200',
      WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      CRITICAL: 'bg-red-100 text-red-800 border-red-200'
    };

    const icons = {
      HEALTHY: '✅',
      WARNING: '⚠️',
      CRITICAL: '🚨'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
        <span className="mr-1">{icons[status]}</span>
        {status.toLowerCase()}
      </span>
    );
  };

  // Render trend indicator
  const renderTrend = (trend: 'UP' | 'DOWN' | 'STABLE') => {
    const icons = {
      UP: '📈',
      DOWN: '📉',
      STABLE: '➡️'
    };

    const colors = {
      UP: 'text-green-600',
      DOWN: 'text-red-600',
      STABLE: 'text-gray-600'
    };

    return (
      <span className={`inline-flex items-center ${colors[trend]}`}>
        <span className="mr-1">{icons[trend]}</span>
        <span className="text-xs">{trend.toLowerCase()}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
                <p className="mt-2 text-slate-600">
                  Comprehensive team insights, metrics, and SLO health monitoring
                </p>
                {lastUpdated && (
                  <p className="text-xs text-slate-500 mt-1">
                    Last updated: {lastUpdated.toLocaleString()}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  <span className="text-sm text-slate-600">Auto-refresh</span>
                </label>
                
                <button
                  onClick={loadAnalyticsData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  <span className="mr-2">🔄</span>
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <span className="text-red-400 text-xl mr-3">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="timeRange" className="block text-sm font-medium text-slate-700 mb-1">
                Time Range
              </label>
              <select
                id="timeRange"
                value={filters.timeRange}
                onChange={(e) => setFilters(f => ({ ...f, timeRange: e.target.value as FilterState['timeRange'] }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            <div>
              <label htmlFor="team" className="block text-sm font-medium text-slate-700 mb-1">
                Team
              </label>
              <select
                id="team"
                value={filters.team}
                onChange={(e) => setFilters(f => ({ ...f, team: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All Teams</option>
                <option value="engineering">Engineering</option>
                <option value="product">Product</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">
                Role
              </label>
              <select
                id="role"
                value={filters.role}
                onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">Users</option>
                <option value="MANAGER">Managers</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
                Department
              </label>
              <select
                id="department"
                value={filters.department}
                onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All Departments</option>
                <option value="technology">Technology</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="hr">Human Resources</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 bg-white rounded-t-lg">
          <nav className="flex">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'cohorts', label: 'Cohort Analysis', icon: '👥' },
              { key: 'teams', label: 'Team Metrics', icon: '🎯' },
              { key: 'slo', label: 'SLO Health', icon: '⚡' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-b-lg shadow-sm border border-gray-200 border-t-0">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading analytics...</p>
              </div>
            </div>
          ) : !analyticsData ? (
            <div className="text-center py-12">
              <span className="text-slate-400 text-4xl mb-4 block">📊</span>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No data available</h3>
              <p className="text-slate-600">Analytics data will appear here once available.</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-blue-600 text-2xl mr-3">🎯</span>
                        <div>
                          <p className="text-sm font-medium text-blue-900">Total Recognitions</p>
                          <p className="text-2xl font-bold text-blue-800">{analyticsData.overview.totalRecognitions.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-green-600 text-2xl mr-3">✅</span>
                        <div>
                          <p className="text-sm font-medium text-green-900">Verified</p>
                          <p className="text-2xl font-bold text-green-800">{analyticsData.overview.verifiedRecognitions.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-purple-600 text-2xl mr-3">📈</span>
                        <div>
                          <p className="text-sm font-medium text-purple-900">Verification Rate</p>
                          <p className="text-2xl font-bold text-purple-800">{analyticsData.overview.verificationRate}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-yellow-600 text-2xl mr-3">⏱️</span>
                        <div>
                          <p className="text-sm font-medium text-yellow-900">Avg Response Time</p>
                          <p className="text-2xl font-bold text-yellow-800">{analyticsData.overview.avgResponseTime}h</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-indigo-600 text-2xl mr-3">👤</span>
                        <div>
                          <p className="text-sm font-medium text-indigo-900">Active Users</p>
                          <p className="text-2xl font-bold text-indigo-800">{analyticsData.overview.activeUsers}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recognition Distribution */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Recognition Distribution by Department</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Department
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Given
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Received
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Avg Weight
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analyticsData.recognitionDistribution.map((dept, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {dept.department}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {dept.given}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {dept.received}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {dept.avgWeight.toFixed(1)}x
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Cohort Analysis Tab */}
              {activeTab === 'cohorts' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-900">Cohort Analysis</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            New Users
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Retention Rate
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recognitions/User
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyticsData.cohortMetrics.map((cohort, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {cohort.month}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {cohort.newUsers}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                cohort.retentionRate >= 80 ? 'bg-green-100 text-green-800' :
                                cohort.retentionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {cohort.retentionRate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {cohort.recognitionsPerUser.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Team Metrics Tab */}
              {activeTab === 'teams' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-900">Team Performance Metrics</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {analyticsData.teamMetrics.map((team, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-medium text-slate-900">{team.teamName}</h4>
                          <span className="text-sm text-slate-500">{team.size} members</span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-600">Recognition Velocity</span>
                            <span className="text-sm font-medium text-slate-900">{team.recognitionVelocity}/week</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-600">Engagement Score</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded ${
                              team.engagementScore >= 80 ? 'bg-green-100 text-green-800' :
                              team.engagementScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {team.engagementScore}%
                            </span>
                          </div>
                          
                          <div>
                            <span className="text-sm text-slate-600 block mb-2">Top Tags</span>
                            <div className="flex flex-wrap gap-1">
                              {team.topTags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SLO Health Tab */}
              {activeTab === 'slo' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-900">Service Level Objective Health</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Metric
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Current
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Target
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trend
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyticsData.sloHealth.map((slo, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {slo.metric}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {slo.current}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {slo.target}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {renderSLOStatus(slo.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {renderTrend(slo.trend)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}