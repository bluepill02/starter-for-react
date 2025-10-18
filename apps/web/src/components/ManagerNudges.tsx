import React from 'react';
import { useI18n } from '../lib/i18n';

interface PendingVerification {
  id: string;
  recognitionId: string;
  giver: {
    name: string;
    avatar?: string;
  };
  recipient: {
    name: string;
    avatar?: string;
  };
  reason: string;
  timestamp: Date;
  urgency: 'low' | 'medium' | 'high';
}

interface TeamInsight {
  type: 'recognition_trend' | 'participation_gap' | 'skill_spotlight';
  title: string;
  description: string;
  actionLabel?: string;
  data?: Record<string, any>;
}

interface ManagerNudgesProps {
  pendingVerifications?: PendingVerification[];
  teamInsights?: TeamInsight[];
  onVerifyRecognition?: (id: string) => void;
  onViewAllPending?: () => void;
  onTeamInsightAction?: (insight: TeamInsight) => void;
  className?: string;
}

export function ManagerNudges({
  pendingVerifications = [],
  teamInsights = [],
  onVerifyRecognition,
  onViewAllPending,
  onTeamInsightAction,
  className = ''
}: ManagerNudgesProps): React.ReactElement {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);

  const sortedPending = pendingVerifications
    .sort((a, b) => {
      const urgencyWeight = { high: 3, medium: 2, low: 1 };
      if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
        return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    })
    .slice(0, 3);

  const getUrgencyColor = (urgency: PendingVerification['urgency']) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return t('dashboard.time_ago_days', { days: diffDays.toString() });
    } else if (diffHours > 0) {
      return t('dashboard.time_ago_hours', { hours: diffHours.toString() });
    } else {
      return t('dashboard.time_ago_recent');
    }
  };

  return (
    <div className={`manager-nudges bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {t('dashboard.manager_nudges')}
      </h2>

      {/* Pending Verifications */}
      {pendingVerifications.length > 0 && (
        <div className="pending-verifications mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              {t('dashboard.pending_verifications')}
            </h3>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {pendingVerifications.length}
            </span>
          </div>

          <div className="space-y-3">
            {sortedPending.map((verification) => (
              <div
                key={verification.id}
                className="verification-item p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {verification.giver.avatar ? (
                      <img
                        src={verification.giver.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full"
                        aria-hidden="true"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600" aria-hidden="true">
                          {verification.giver.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {verification.giver.name}
                      </span>
                      <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                      </svg>
                      <span className="text-sm text-gray-600">
                        {verification.recipient.name}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {verification.reason}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(verification.urgency)}`}>
                          {t(`dashboard.urgency_${verification.urgency}`)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(verification.timestamp)}
                        </span>
                      </div>

                      <button
                        onClick={() => onVerifyRecognition?.(verification.id)}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        aria-label={t('dashboard.verify_recognition_aria', { 
                          giver: verification.giver.name,
                          recipient: verification.recipient.name 
                        })}
                      >
                        {t('dashboard.verify')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pendingVerifications.length > 3 && (
            <button
              onClick={onViewAllPending}
              className="w-full mt-3 p-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('dashboard.view_all_pending', { count: pendingVerifications.length.toString() })}
            </button>
          )}
        </div>
      )}

      {/* Team Insights */}
      {teamInsights.length > 0 && (
        <div className="team-insights">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {t('dashboard.team_insights')}
          </h3>

          <div className="space-y-3">
            {teamInsights.map((insight, index) => (
              <div
                key={index}
                className="insight-item p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {insight.type === 'recognition_trend' && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
                        </svg>
                      </div>
                    )}
                    {insight.type === 'participation_gap' && (
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                        </svg>
                      </div>
                    )}
                    {insight.type === 'skill_spotlight' && (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11 8.57,12.64 10.57,12.92V13H13.43V12.92C15.43,12.64 17,11 17,9A5,5 0 0,0 12,4Z"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-gray-600 mb-2">
                      {insight.description}
                    </p>
                    
                    {insight.actionLabel && (
                      <button
                        onClick={() => onTeamInsightAction?.(insight)}
                        className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      >
                        {insight.actionLabel}
                        <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingVerifications.length === 0 && teamInsights.length === 0 && (
        <div className="empty-state text-center py-6">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9,12L11,14L15,10L20.59,15.59L22,14.17L15,7.17L11,11.17L9,9.17L2.41,15.76L3.83,17.17L9,12M2,19V21H22V19H2Z"/>
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {t('dashboard.no_pending_items')}
          </p>
          <p className="text-xs text-gray-500">
            {t('dashboard.all_caught_up')}
          </p>
        </div>
      )}
    </div>
  );
}

export default ManagerNudges;