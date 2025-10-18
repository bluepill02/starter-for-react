import React from 'react';
import { useI18n } from '../lib/i18n';

interface QuickActionsProps {
  onNewRecognition?: () => void;
  onViewTemplates?: () => void;
  onInviteTeam?: () => void;
  onViewAnalytics?: () => void;
  className?: string;
}

export function QuickActions({
  onNewRecognition,
  onViewTemplates,
  onInviteTeam,
  onViewAnalytics,
  className = ''
}: QuickActionsProps): React.ReactElement {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);

  return (
    <div className={`quick-actions bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {t('dashboard.quick_actions')}
      </h2>

      {/* Primary Actions */}
      <div className="space-y-3 mb-6">
        <button
          onClick={onNewRecognition}
          className="action-btn w-full flex items-center gap-3 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
          <span className="font-medium">{t('recognize.button')}</span>
        </button>

        <button
          onClick={onViewTemplates}
          className="action-btn w-full flex items-center gap-3 p-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9,3H15V5H9V3M13,7H11V10H7V12H11V15H13V12H17V10H13V7M5,2C3.89,2 3,2.89 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V8L15,2H5Z"/>
          </svg>
          <span>{t('dashboard.templates')}</span>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="space-y-2">
        <button
          onClick={onInviteTeam}
          className="action-btn w-full flex items-center gap-3 p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16,4C18.21,4 20,5.79 20,8C20,10.21 18.21,12 16,12C13.79,12 12,10.21 12,8C12,5.79 13.79,4 16,4M16,13C18.67,13 22,14.33 22,17V20H10V17C10,14.33 13.33,13 16,13M8,12C10.21,12 12,10.21 12,8C12,5.79 10.21,4 8,4C5.79,4 4,5.79 4,8C4,10.21 5.79,12 8,12M8,13C5.33,13 2,14.33 2,17V20H9V17C9,15.03 10.22,13.5 12,12.5C11.13,12.18 10.06,12 8,12Z"/>
          </svg>
          <span className="text-sm">{t('dashboard.invite_team')}</span>
        </button>

        <button
          onClick={onViewAnalytics}
          className="action-btn w-full flex items-center gap-3 p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22,21H2V3H4V19H6V17H10V19H12V16H16V19H18V17H22V21M16,8H18V15H16V8M12,2H14V15H12V2M8,9H10V15H8V9M4,11H6V15H4V11Z"/>
          </svg>
          <span className="text-sm">{t('dashboard.view_analytics')}</span>
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="shortcuts mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {t('dashboard.shortcuts')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{t('dashboard.new_recognition')}</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono">
              N
            </kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{t('dashboard.search')}</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono">
              /
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickActions;