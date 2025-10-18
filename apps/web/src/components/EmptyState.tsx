import React from 'react';
import { useI18n } from '../lib/i18n';

interface EmptyStateProps {
  type?: 'no_recognitions' | 'no_results' | 'no_activity';
  title?: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  illustration?: 'recognition' | 'search' | 'activity';
  className?: string;
}

export function EmptyState({
  type = 'no_recognitions',
  title,
  description,
  primaryAction,
  secondaryAction,
  illustration,
  className = ''
}: EmptyStateProps): React.ReactElement {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);

  // Default content based on type
  const getDefaultContent = () => {
    switch (type) {
      case 'no_recognitions':
        return {
          title: t('dashboard.no_recognitions_title'),
          description: t('dashboard.no_recognitions_description'),
          illustration: 'recognition'
        };
      case 'no_results':
        return {
          title: t('dashboard.no_results_title'),
          description: t('dashboard.no_results_description'),
          illustration: 'search'
        };
      case 'no_activity':
        return {
          title: t('dashboard.no_activity_title'),
          description: t('dashboard.no_activity_description'),
          illustration: 'activity'
        };
      default:
        return {
          title: t('dashboard.no_recognitions_title'),
          description: t('dashboard.no_recognitions_description'),
          illustration: 'recognition'
        };
    }
  };

  const defaultContent = getDefaultContent();
  const finalTitle = title || defaultContent.title;
  const finalDescription = description || defaultContent.description;
  const finalIllustration = illustration || defaultContent.illustration;

  const getIllustrationIcon = () => {
    switch (finalIllustration) {
      case 'recognition':
        return (
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M21,12C21,9.97 20.33,8.09 19,6.58L17.58,8C18.61,9.23 19.2,10.54 19.2,12C19.2,15.35 16.35,18.2 13,18.2S6.8,15.35 6.8,12C6.8,10.54 7.39,9.23 8.42,8L7,6.58C5.67,8.09 5,9.97 5,12A8,8 0 0,0 13,20A8,8 0 0,0 21,12M12,2L14.39,6.42C13.65,6.15 12.84,6 12,6C11.16,6 10.35,6.15 9.61,6.42L12,2Z"/>
            </svg>
          </div>
        );
      case 'search':
        return (
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
            </svg>
          </div>
        );
      case 'activity':
        return (
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`empty-state text-center py-12 px-6 ${className}`}>
      {/* Illustration */}
      {getIllustrationIcon()}

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {finalTitle}
      </h3>

      {/* Description */}
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {finalDescription}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* Helpful tips for first-time users */}
      {type === 'no_recognitions' && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            {t('dashboard.getting_started')}
          </h4>
          <ul className="text-sm text-blue-800 space-y-1 text-left max-w-sm mx-auto">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              {t('dashboard.tip_recognize_colleague')}
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              {t('dashboard.tip_add_evidence')}
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              {t('dashboard.tip_choose_visibility')}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default EmptyState;