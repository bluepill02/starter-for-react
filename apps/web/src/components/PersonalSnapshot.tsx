import React from 'react';
import { useI18n } from '../lib/i18n';

interface PersonalStats {
  givenThisMonth: number;
  receivedThisMonth: number;
  givenAllTime: number;
  receivedAllTime: number;
  engagementScore: number;
}

interface PersonalSnapshotProps {
  stats: PersonalStats;
  recentActivity?: Array<{
    id: string;
    type: 'given' | 'received';
    otherPersonName: string;
    timeAgo: string;
  }>;
  className?: string;
}

export function PersonalSnapshot({ 
  stats, 
  recentActivity = [],
  className = '' 
}: PersonalSnapshotProps): React.ReactElement {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);

  return (
    <div className={`personal-snapshot bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {t('dashboard.personal_snapshot')}
      </h2>

      {/* Stats Grid */}
      <div className="stats-grid space-y-3 mb-6">
        {/* This Month */}
        <div className="month-stats">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('dashboard.this_month')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-item p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">
                {stats.givenThisMonth}
              </div>
              <div className="text-xs text-blue-700">
                {t('dashboard.given')}
              </div>
            </div>
            <div className="stat-item p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">
                {stats.receivedThisMonth}
              </div>
              <div className="text-xs text-green-700">
                {t('dashboard.received')}
              </div>
            </div>
          </div>
        </div>

        {/* All Time */}
        <div className="alltime-stats">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('dashboard.all_time')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-item p-2 bg-gray-50 rounded">
              <div className="text-lg font-semibold text-gray-900">
                {stats.givenAllTime}
              </div>
              <div className="text-xs text-gray-600">
                {t('dashboard.given')}
              </div>
            </div>
            <div className="stat-item p-2 bg-gray-50 rounded">
              <div className="text-lg font-semibold text-gray-900">
                {stats.receivedAllTime}
              </div>
              <div className="text-xs text-gray-600">
                {t('dashboard.received')}
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Score */}
        <div className="engagement-score p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-purple-700">
                {stats.engagementScore}
              </div>
              <div className="text-xs text-purple-600">
                {t('analytics.engagement_score')}
              </div>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="recent-activity">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {t('dashboard.team_activity')}
          </h3>
          <div className="space-y-2">
            {recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="activity-item flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  activity.type === 'given' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {activity.type === 'given' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M10,17L18,9L16.59,7.58L10,14.17L7.41,11.59L6,13L10,17Z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7,13L11,17L17,7L15.59,8.41L11,15.17L8.41,12.59L7,13Z"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {activity.type === 'given' 
                      ? `You recognized ${activity.otherPersonName}`
                      : `${activity.otherPersonName} recognized you`
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.timeAgo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalSnapshot;