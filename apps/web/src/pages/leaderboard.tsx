/**
 * Leaderboard Page
 * Displays ranked recognition givers and receivers with engagement metrics
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { LeaderboardFilter } from '../components/LeaderboardFilter';

type Period = 'week' | 'month' | 'all';
type LeaderboardType = 'givers' | 'receivers';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatar: string;
  givenCount?: number;
  receivedCount?: number;
  engagementScore: number;
  trend?: 'up' | 'down' | 'steady';
  streak?: number;
  verifiedCount?: number;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const i18n = useI18n('leaderboard');
  const t = (key: string) => typeof i18n === 'string' ? i18n : i18n?.[key] || key;

  const [type, setType] = useState<LeaderboardType>('givers');
  const [period, setPeriod] = useState<Period>('month');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/leaderboard?type=${type}&period=${period}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard (${response.status})`);
        }

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setLeaderboard(result.data);
        } else {
          throw new Error('Invalid leaderboard response');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard';
        setError(errorMessage);
        console.error('Leaderboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [type, period]);

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🏆 {t('title') || 'Leaderboard'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {type === 'givers'
              ? t('subtitle_givers') || 'Celebrating top recognition givers'
              : t('subtitle_receivers') || 'Celebrating most recognized employees'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <LeaderboardFilter
            currentType={type}
            currentPeriod={period}
            onTypeChange={setType}
            onPeriodChange={setPeriod}
            isLoading={loading}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">📤</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('given') || 'Given'}</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">📥</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('received') || 'Received'}</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">✓</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('verified') || 'Verified'}</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">🔥</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('streak') || 'Streak'}</div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            className="p-4 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700"
            role="alert"
          >
            <p className="text-red-700 dark:text-red-200 font-medium">{t('error_loading') || 'Error loading leaderboard'}</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
                aria-hidden="true"
              ></div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && leaderboard.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {t('empty_message') || 'No recognitions yet'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {t('empty_hint') || 'Start giving recognitions to appear on the leaderboard'}
            </p>
          </div>
        )}

        {/* Leaderboard List */}
        {!loading && leaderboard.length > 0 && (
          <div
            className="space-y-3"
            role="list"
            aria-label={`${type === 'givers' ? 'Top givers' : 'Top receivers'} leaderboard`}
          >
            {leaderboard.map((entry) => (
              <div key={entry.userId} role="listitem">
                <LeaderboardCard
                  entry={entry}
                  type={type}
                  onClick={handleUserClick}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer Info */}
        {!loading && leaderboard.length > 0 && (
          <div className="mt-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              <span className="font-semibold">{t('info_title') || 'Engagement Score'}</span>
              {': '}
              {t('info_description') || 'Calculated from recognition weight, verification status, shares, and views'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Metadata for SEO
LeaderboardPage.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <>
      <head>
        <title>Leaderboard | Recognition App</title>
        <meta name="description" content="View top recognition givers and receivers" />
        <meta property="og:title" content="Leaderboard" />
        <meta property="og:description" content="Celebrate our top recognition givers and receivers" />
      </head>
      {page}
    </>
  );
};
