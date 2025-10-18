/**
 * LeaderboardCard Component
 * Displays a single ranking entry with user info, stats, trend, and streak
 */

import React from 'react';
import { useI18n } from '../lib/i18n';

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

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  type: 'givers' | 'receivers';
  onClick?: (userId: string) => void;
}

const trendIndicators = {
  up: { icon: '↑', color: 'text-green-600 dark:text-green-400', label: 'Trending up' },
  down: { icon: '↓', color: 'text-red-600 dark:text-red-400', label: 'Trending down' },
  steady: { icon: '→', color: 'text-gray-400 dark:text-gray-500', label: 'Steady' },
};

export function LeaderboardCard({ entry, type, onClick }: LeaderboardCardProps) {
  const i18n = useI18n('leaderboard');
  const t = (key: string) => typeof i18n === 'string' ? i18n : i18n?.[key] || key;

  const handleClick = () => {
    if (onClick) {
      onClick(entry.userId);
    }
  };

  const trend = entry.trend || 'steady';
  const trendData = trendIndicators[trend];

  // Medal emojis for top 3
  const medalMap = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const rankDisplay = medalMap[entry.rank as keyof typeof medalMap] || `#${entry.rank}`;

  return (
    <div
      onClick={handleClick}
      className="
        relative flex items-center justify-between p-4
        rounded-lg border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-800
        hover:shadow-md dark:hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900
        transition-all duration-200 cursor-pointer
        group
      "
      role="article"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label={`${rankDisplay} ${entry.displayName}: ${t('engagement_score')}: ${entry.engagementScore}`}
    >
      {/* Rank Badge */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 w-12 text-center">
          {rankDisplay}
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0 w-12 h-12">
          {entry.avatar ? (
            <img
              src={entry.avatar}
              alt={entry.displayName}
              className="w-full h-full rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            />
          ) : (
            <div className="
              w-full h-full rounded-full
              bg-gradient-to-br from-blue-400 to-purple-500
              flex items-center justify-center text-white font-bold text-lg
            ">
              {entry.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name & Stats */}
        <div className="flex-1 min-w-0">
          <h3 className="
            text-lg font-semibold text-gray-900 dark:text-white
            truncate group-hover:text-blue-600 dark:group-hover:text-blue-400
            transition-colors
          ">
            {entry.displayName}
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {type === 'givers' && (
              <span aria-label={`Given: ${entry.givenCount}`}>
                📤 {entry.givenCount || 0} {t('given')}
              </span>
            )}
            {type === 'receivers' && (
              <span aria-label={`Received: ${entry.receivedCount}`}>
                📥 {entry.receivedCount || 0} {t('received')}
              </span>
            )}
            {entry.verifiedCount !== undefined && (
              <span className="ml-3" aria-label={`Verified: ${entry.verifiedCount}`}>
                ✓ {entry.verifiedCount} {t('verified')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Side: Score, Trend, Streak */}
      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        {/* Engagement Score */}
        <div className="text-right min-w-max">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {entry.engagementScore}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('engagement')}
          </div>
        </div>

        {/* Trend Indicator */}
        <div
          className={`text-xl font-bold ${trendData.color}`}
          title={trendData.label}
          aria-label={trendData.label}
        >
          {trendData.icon}
        </div>

        {/* Streak Badge */}
        {entry.streak && entry.streak > 0 && (
          <div className="
            flex items-center gap-1 px-2 py-1 rounded-full
            bg-orange-100 dark:bg-orange-900
            text-orange-700 dark:text-orange-200
            text-sm font-semibold
          " aria-label={`${entry.streak} day streak`}>
            🔥 {entry.streak}d
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardCard;
