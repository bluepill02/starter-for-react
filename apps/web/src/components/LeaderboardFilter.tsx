/**
 * LeaderboardFilter Component
 * Provides period and type selectors for leaderboard filtering
 */

import React from 'react';
import { useI18n } from '../lib/i18n';

type Period = 'week' | 'month' | 'all';
type LeaderboardType = 'givers' | 'receivers';

interface LeaderboardFilterProps {
  currentPeriod: Period;
  currentType: LeaderboardType;
  onPeriodChange: (period: Period) => void;
  onTypeChange: (type: LeaderboardType) => void;
  isLoading?: boolean;
}

export function LeaderboardFilter({
  currentPeriod,
  currentType,
  onPeriodChange,
  onTypeChange,
  isLoading = false,
}: LeaderboardFilterProps) {
  const i18n = useI18n('leaderboard');
  const t = (key: string) => typeof i18n === 'string' ? i18n : i18n?.[key] || key;

  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: t('period_week') || 'This Week' },
    { value: 'month', label: t('period_month') || 'This Month' },
    { value: 'all', label: t('period_all') || 'All Time' },
  ];

  const types: { value: LeaderboardType; label: string }[] = [
    { value: 'givers', label: t('givers') || 'Givers' },
    { value: 'receivers', label: t('receivers') || 'Receivers' },
  ];

  return (
    <div
      className="
        flex flex-col sm:flex-row gap-4 p-4
        rounded-lg border border-gray-200 dark:border-gray-700
        bg-gray-50 dark:bg-gray-800
        max-w-full overflow-x-auto
      "
      role="toolbar"
      aria-label={t('filters') || 'Leaderboard filters'}
    >
      {/* Type Selector */}
      <fieldset className="flex items-center gap-2">
        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 sr-only">
          {t('leaderboard_type') || 'Leaderboard Type'}
        </legend>
        <div className="flex gap-2">
          {types.map((type) => (
            <button
              key={type.value}
              onClick={() => onTypeChange(type.value)}
              disabled={isLoading}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-blue-500 dark:focus:ring-offset-gray-900
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  currentType === type.value
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }
              `}
              aria-pressed={currentType === type.value ? 'true' : 'false'}
            >
              {type.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-gray-300 dark:bg-gray-600"></div>

      {/* Period Selector */}
      <fieldset className="flex items-center gap-2">
        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300 sr-only">
          {t('time_period') || 'Time Period'}
        </legend>
        <div className="flex gap-2 flex-wrap">
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => onPeriodChange(period.value)}
              disabled={isLoading}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-blue-500 dark:focus:ring-offset-gray-900
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  currentPeriod === period.value
                    ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }
              `}
              aria-pressed={currentPeriod === period.value ? 'true' : 'false'}
            >
              {period.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ml-auto">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>{t('loading') || 'Loading...'}</span>
        </div>
      )}
    </div>
  );
}

export default LeaderboardFilter;
