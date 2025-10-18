// Admin Growth - Team Growth and Engagement Metrics
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { getDatabase, getFunctions } from '../../appwrite/client';

interface GrowthMetrics {
  userGrowth: {
    period: string;
    newUsers: number;
    activeUsers: number;
    churnRate: number;
    growthRate: number;
  }[];
  engagementMetrics: {
    metric: string;
    current: number;
    previous: number;
    change: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  }[];
  recognitionTrends: {
    week: string;
    total: number;
    verified: number;
    avgWeight: number;
    topTags: string[];
  }[];
  teamHealth: {
    teamName: string;
    healthScore: number;
    participationRate: number;
    recognitionBalance: number; // Given vs received balance
    riskFactors: string[];
    strengths: string[];
  }[];
  predictiveInsights: {
    category: string;
    prediction: string;
    confidence: number;
    recommendation: string;
    timeframe: string;
  }[];
}

export default function GrowthPage(): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const t = useI18n;
  const databases = getDatabase();
  const functions = getFunctions();

  // State management
  const [growthData, setGrowthData] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '6m' | '1y'>('90d');
  const [activeInsight, setActiveInsight] = useState<string | null>(null);

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
            <p className="text-gray-600">Manager access required for growth insights.</p>
          </div>
        </div>
      </div>
    );
  }

  // Load growth data
  const loadGrowthData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await functions.createExecution(
        'admin-growth-insights',
        JSON.stringify({ timeframe: selectedTimeframe })
      );

      const result = JSON.parse(response.responseBody);

      if (result.success) {
        setGrowthData(result.data);
      } else {
        setError(result.error || 'Failed to load growth data');
      }

    } catch (err) {
      console.error('Failed to load growth data:', err);
      setError('Failed to load growth insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeframe, functions]);

  useEffect(() => {
    loadGrowthData();
  }, [loadGrowthData]);

  // Render trend indicator
  const renderTrend = (trend: 'UP' | 'DOWN' | 'STABLE', change: number) => {
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
      <div className={`flex items-center ${colors[trend]}`}>
        <span className="mr-1">{icons[trend]}</span>
        <span className="text-sm font-medium">
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      </div>
    );
  };

  // Render health score
  const renderHealthScore = (score: number) => {
    let color = 'bg-red-100 text-red-800';
    let icon = '🚨';
    
    if (score >= 80) {
      color = 'bg-green-100 text-green-800';
      icon = '💚';
    } else if (score >= 60) {
      color = 'bg-yellow-100 text-yellow-800';
      icon = '⚠️';
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        <span className="mr-1">{icon}</span>
        {score}/100
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
                <h1 className="text-3xl font-bold text-slate-900">Growth & Insights</h1>
                <p className="mt-2 text-slate-600">
                  Monitor team growth, engagement patterns, and predictive insights
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  aria-label="Select timeframe for growth analysis"
                >
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="6m">Last 6 months</option>
                  <option value="1y">Last year</option>
                </select>
                
                <button
                  onClick={loadGrowthData}
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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading growth insights...</p>
          </div>
        </div>
      ) : !growthData ? (
        <div className="text-center py-12">
          <span className="text-slate-400 text-4xl mb-4 block">📈</span>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No growth data available</h3>
          <p className="text-slate-600">Growth insights will appear here once available.</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Engagement Metrics Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Engagement Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {growthData.engagementMetrics.map((metric, index) => (
                <div key={index} className="text-center">
                  <h3 className="text-sm font-medium text-slate-600 mb-2">{metric.metric}</h3>
                  <div className="text-2xl font-bold text-slate-900 mb-1">{metric.current.toLocaleString()}</div>
                  {renderTrend(metric.trend, metric.change)}
                  <div className="text-xs text-slate-500 mt-1">
                    vs {metric.previous.toLocaleString()} last period
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Growth Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">User Growth Trends</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Churn Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Growth Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {growthData.userGrowth.map((period, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {period.period}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {period.newUsers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {period.activeUsers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          period.churnRate <= 5 ? 'bg-green-100 text-green-800' :
                          period.churnRate <= 10 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {period.churnRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          period.growthRate >= 10 ? 'bg-green-100 text-green-800' :
                          period.growthRate >= 0 ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {period.growthRate > 0 ? '+' : ''}{period.growthRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Health Dashboard */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Team Health Dashboard</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {growthData.teamHealth.map((team, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-slate-900">{team.teamName}</h3>
                    {renderHealthScore(team.healthScore)}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Participation Rate</span>
                      <span className="text-sm font-medium text-slate-900">{team.participationRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Recognition Balance</span>
                      <span className={`text-sm font-medium ${
                        Math.abs(team.recognitionBalance) <= 10 ? 'text-green-600' :
                        Math.abs(team.recognitionBalance) <= 25 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {team.recognitionBalance > 0 ? '+' : ''}{team.recognitionBalance}%
                      </span>
                    </div>
                    
                    {/* Strengths */}
                    {team.strengths.length > 0 && (
                      <div>
                        <span className="text-sm text-slate-600 block mb-1">Strengths</span>
                        <div className="flex flex-wrap gap-1">
                          {team.strengths.map((strength, strengthIndex) => (
                            <span
                              key={strengthIndex}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                            >
                              {strength}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Risk Factors */}
                    {team.riskFactors.length > 0 && (
                      <div>
                        <span className="text-sm text-slate-600 block mb-1">Risk Factors</span>
                        <div className="flex flex-wrap gap-1">
                          {team.riskFactors.map((risk, riskIndex) => (
                            <span
                              key={riskIndex}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                            >
                              {risk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recognition Trends */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recognition Trends</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verified
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Top Tags
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {growthData.recognitionTrends.map((week, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {week.week}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {week.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {week.verified} ({Math.round((week.verified / week.total) * 100)}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {week.avgWeight.toFixed(1)}x
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {week.topTags.slice(0, 3).map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Predictive Insights */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Predictive Insights</h2>
            <div className="space-y-4">
              {growthData.predictiveInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors ${
                    activeInsight === insight.category ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveInsight(activeInsight === insight.category ? null : insight.category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-slate-900">{insight.category}</h3>
                        <div className="flex items-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium mr-2 ${
                            insight.confidence >= 80 ? 'bg-green-100 text-green-800' :
                            insight.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {insight.confidence}% confidence
                          </span>
                          <span className="text-slate-400">
                            {activeInsight === insight.category ? '−' : '+'}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-2">{insight.prediction}</p>
                      
                      {activeInsight === insight.category && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-md">
                          <h4 className="text-sm font-medium text-blue-900 mb-1">Recommendation</h4>
                          <p className="text-sm text-blue-800 mb-2">{insight.recommendation}</p>
                          <p className="text-xs text-blue-600">Timeframe: {insight.timeframe}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}