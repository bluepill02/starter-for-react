/**
 * Analytics Page
 * Displays personal engagement analytics with stats and charts
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

interface DailyStat {
  date: string;
  count: number;
}

interface AnalyticsData {
  userId: string;
  period: number;
  given: {
    totalAllTime: number;
    inPeriod: number;
    trend: number;
    daily: DailyStat[];
  };
  received: {
    totalAllTime: number;
    inPeriod: number;
    trend: number;
    daily: DailyStat[];
    verified: number;
  };
  shares: {
    totalShares: number;
    totalViews: number;
    byPlatform: Record<string, number>;
  };
  topRecognitions: {
    given: { id: string; reason: string; weight: number; views: number; verified: boolean } | null;
    received: { id: string; reason: string; weight: number; views: number; verified: boolean } | null;
  };
  engagementScore: number;
}

export default function AnalyticsPage() {
  const auth = useAuth();
  const user = auth && typeof auth === 'object' && '$id' in auth ? auth : null;
  const i18n = useI18n('analytics');
  const t = (key: string) => typeof i18n === 'string' ? i18n : i18n?.[key] || key;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analytics?userId=${(user as { $id: string }).$id}&period=30`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch analytics (${response.status})`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setAnalytics(result.data);
        } else {
          throw new Error('Invalid analytics response');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
        setError(errorMessage);
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">{t('not_signed_in') || 'Please sign in to view your analytics'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            📊 {t('title') || 'Your Analytics'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('subtitle') || 'Last 30 days of engagement metrics'}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 mb-8">
            <p className="text-red-700 dark:text-red-200 font-medium">{t('error') || 'Error loading analytics'}</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
                aria-hidden="true"
              ></div>
            ))}
          </div>
        )}

        {/* Analytics Content */}
        {!loading && analytics && (
          <div className="space-y-8">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Given */}
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">📤</span>
                  <span
                    className={`text-sm font-bold ${
                      analytics.given.trend >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {analytics.given.trend >= 0 ? '+' : ''}{analytics.given.trend}
                  </span>
                </div>
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('given_this_month') || 'Given this Month'}</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{analytics.given.inPeriod}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{t('all_time') || 'All-time'}: {analytics.given.totalAllTime}</p>
              </div>

              {/* Received */}
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">📥</span>
                  <span
                    className={`text-sm font-bold ${
                      analytics.received.trend >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {analytics.received.trend >= 0 ? '+' : ''}{analytics.received.trend}
                  </span>
                </div>
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('received_this_month') || 'Received this Month'}</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{analytics.received.inPeriod}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{t('verified') || 'Verified'}: {analytics.received.verified}</p>
              </div>

              {/* Shares */}
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">📤</span>
                </div>
                <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('shares') || 'Shares'}</h3>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{analytics.shares.totalShares}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{t('views') || 'Views'}: {analytics.shares.totalViews}</p>
              </div>

              {/* Engagement Score */}
              <div className="p-6 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1">{t('engagement_score') || 'Engagement Score'}</h3>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-200">{analytics.engagementScore}</p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">{t('based_on') || 'Based on activity'}</p>
              </div>
            </div>

            {/* Share Breakdown */}
            {Object.keys(analytics.shares.byPlatform).length > 0 && (
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('shares_by_platform') || 'Shares by Platform'}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(analytics.shares.byPlatform).map(([platform, count]) => (
                    <div key={platform} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{platform}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Recognition */}
            {analytics.topRecognitions.given && (
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('top_recognition') || 'Your Top Recognition'}</h2>
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border border-purple-200 dark:border-purple-700">
                  <p className="text-gray-700 dark:text-gray-200 mb-3 line-clamp-2">"{analytics.topRecognitions.given.reason}..."</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{t('weight') || 'Weight'}: {analytics.topRecognitions.given.weight}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{t('views') || 'Views'}: {analytics.topRecognitions.given.views}</p>
                    </div>
                    {analytics.topRecognitions.given.verified && (
                      <span className="ml-auto px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs font-semibold">✓ {t('verified') || 'Verified'}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Export */}
            <div className="p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('export') || 'Export'}</h2>
              <button
                className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
                onClick={() => {
                  const csv = `Date,Given,Received\n${analytics.given.daily.map((day, idx) => `${day.date},${day.count},${analytics.received.daily[idx]?.count || 0}`).join('\n')}`;
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                }}
              >
                📥 {t('download_csv') || 'Download CSV'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Metadata for SEO
AnalyticsPage.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <>
      <head>
        <title>Analytics | Recognition App</title>
        <meta name="description" content="View your engagement analytics" />
      </head>
      {page}
    </>
  );
};
