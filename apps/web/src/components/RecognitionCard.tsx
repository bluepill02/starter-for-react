import React, { useState } from 'react';
import { useI18n } from '../lib/i18n';

export interface Recognition {
  $id: string;
  giverId: string;
  giverName: string;
  giverAvatar?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  reason: string;
  tags: string[];
  evidenceStorageId?: string;
  evidencePreviewUrl?: string;
  evidenceType?: 'image' | 'video' | 'document';
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  weight: number;
  verified: boolean;
  verifierId?: string;
  verifierName?: string;
  verificationNote?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  reactions?: { emoji: string; count: number; userReacted: boolean }[];
  commentsCount?: number;
}

interface RecognitionCardProps {
  recognition: Recognition;
  onReact?: (recognitionId: string, emoji: string) => void;
  onComment?: (recognitionId: string) => void;
  onPublish?: (recognitionId: string) => void;
  onShare?: (recognitionId: string) => void;
  onEvidenceClick?: (recognitionId: string, evidenceUrl: string) => void;
  className?: string;
}

export function RecognitionCard({
  recognition,
  onReact,
  onComment,
  onPublish,
  onShare,
  onEvidenceClick,
  className = ''
}: RecognitionCardProps): React.ReactElement {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);
  const [showActions, setShowActions] = useState(false);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return t('feed.today');
    if (diffInMinutes < 60) return t('feed.ago', { time: `${diffInMinutes}m` });
    if (diffInMinutes < 1440) return t('feed.ago', { time: `${Math.floor(diffInMinutes / 60)}h` });
    if (diffInMinutes < 2880) return t('feed.yesterday');
    return t('feed.daysAgo', { days: String(Math.floor(diffInMinutes / 1440)) });
  };

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case 'PRIVATE':
        return { label: t('dashboard.private_badge'), className: 'bg-gray-100 text-gray-700' };
      case 'TEAM':
        return { label: t('dashboard.team_badge'), className: 'bg-blue-100 text-blue-700' };
      case 'PUBLIC':
        return { label: t('dashboard.public_badge'), className: 'bg-green-100 text-green-700' };
      default:
        return { label: visibility, className: 'bg-gray-100 text-gray-700' };
    }
  };

  const getVerificationBadge = () => {
    if (recognition.verified) {
      return { label: t('dashboard.verified_badge'), className: 'bg-emerald-100 text-emerald-700' };
    }
    return { label: t('dashboard.pending_badge'), className: 'bg-amber-100 text-amber-700' };
  };

  const visibilityBadge = getVisibilityBadge(recognition.visibility);
  const verificationBadge = getVerificationBadge();

  return (
    <article
      className={`recognition-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${className}`}
      aria-label={t('dashboard.aria_recognition_card', { 
        giver: recognition.giverName, 
        recipient: recognition.recipientName 
      })}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Card Header */}
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Giver Avatar */}
          <div className="giver-avatar w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            {recognition.giverAvatar ? (
              <img 
                src={recognition.giverAvatar} 
                alt="" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-blue-700 font-medium text-sm">
                {recognition.giverName.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </span>
            )}
          </div>

          {/* Recognition Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium text-gray-900">{recognition.giverName}</span>
              {' '}{t('feed.gaveRecognition', { giver: '', recipient: '' }).replace(' ', ' recognized ')}
              <span className="font-medium text-blue-600">{recognition.recipientName}</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <time className="text-xs text-gray-500" dateTime={recognition.createdAt}>
                {formatTimeAgo(recognition.createdAt)}
              </time>
              {recognition.evidenceStorageId && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                  {t('dashboard.evidence_rich')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visibilityBadge.className}`}>
            {visibilityBadge.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verificationBadge.className}`}>
            {verificationBadge.label}
          </span>
        </div>
      </header>

      {/* Recognition Content */}
      <div className="recognition-content mb-3">
        <p className="text-gray-900 text-sm leading-relaxed mb-2">
          {recognition.reason}
        </p>

        {/* Tags */}
        {recognition.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {recognition.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Evidence Thumbnail */}
        {recognition.evidenceStorageId && recognition.evidencePreviewUrl && (
          <div className="evidence-thumbnail mt-2">
            <button
              onClick={() => onEvidenceClick?.(recognition.$id, recognition.evidencePreviewUrl!)}
              className="evidence-preview block w-full max-w-sm rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('dashboard.aria_evidence')}
            >
              {recognition.evidenceType === 'image' ? (
                <img
                  src={recognition.evidencePreviewUrl}
                  alt={t('dashboard.evidence_thumbnail')}
                  className="w-full h-32 object-cover"
                />
              ) : recognition.evidenceType === 'video' ? (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center relative">
                  <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span className="absolute bottom-2 right-2 text-xs bg-black/70 text-white px-1 rounded">
                    VIDEO
                  </span>
                </div>
              ) : (
                <div className="w-full h-20 bg-gray-50 flex items-center justify-center border-dashed border-2 border-gray-200">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    <span className="text-xs text-gray-500">Document</span>
                  </div>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Verification Note */}
        {recognition.verified && recognition.verificationNote && (
          <div className="verification-note mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm">
            <p className="text-emerald-800">
              <span className="font-medium">
                {t('feed.verifiedBy', { name: recognition.verifierName || 'Manager' })}:
              </span>
              {' '}{recognition.verificationNote}
            </p>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <footer className="recognition-footer">
        {/* Reactions */}
        {recognition.reactions && recognition.reactions.length > 0 && (
          <div className="flex items-center gap-1 mb-2">
            {recognition.reactions.map((reaction, index) => (
              <button
                key={index}
                onClick={() => onReact?.(recognition.$id, reaction.emoji)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  reaction.userReacted
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                aria-label={`${reaction.emoji} ${reaction.count}`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className={`action-buttons flex items-center gap-2 transition-opacity ${
          showActions ? 'opacity-100' : 'opacity-0'
        }`}>
          <button
            onClick={() => onReact?.(recognition.$id, '👏')}
            className="action-btn text-xs px-3 py-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t('dashboard.aria_react_button')}
          >
            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23 10c0-1.105-.895-2-2-2h-6.539l.993-4.929c.045-.224.046-.46 0-.684C15.348 1.7 14.7 1 13.906 1c-.425 0-.82.236-1.022.613L9.539 8H4c-1.105 0-2 .895-2 2v9c0 1.105.895 2 2 2h16c.738 0 1.376-.405 1.723-1.001L23 10z"/>
            </svg>
            {t('dashboard.react')}
          </button>

          {recognition.commentsCount !== undefined && (
            <button
              onClick={() => onComment?.(recognition.$id)}
              className="action-btn text-xs px-3 py-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('dashboard.aria_comment_button')}
            >
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21,6H3A1,1 0 0,0 2,7V17A1,1 0 0,0 3,18H9L12,21L15,18H21A1,1 0 0,0 22,17V7A1,1 0 0,0 21,6Z"/>
              </svg>
              {t('dashboard.comment')} {recognition.commentsCount > 0 && `(${recognition.commentsCount})`}
            </button>
          )}

          {recognition.visibility === 'PRIVATE' && onPublish && (
            <button
              onClick={() => onPublish(recognition.$id)}
              className="action-btn text-xs px-3 py-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label={t('dashboard.aria_publish_button')}
            >
              <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8L16,12L12,16L8,12L12,8Z"/>
              </svg>
              {t('dashboard.publish')}
            </button>
          )}

          <button
            onClick={() => onShare?.(recognition.$id)}
            className="action-btn text-xs px-3 py-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label={t('dashboard.aria_share_button')}
          >
            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19A2.92,2.92 0 0,0 18,16.08Z"/>
            </svg>
            {t('dashboard.share')}
          </button>
        </div>
      </footer>
    </article>
  );
}

export default RecognitionCard;