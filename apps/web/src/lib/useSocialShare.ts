/**
 * useSocialShare Hook
 * Manages social sharing state and provides methods to share recognitions
 * Supports Slack, Teams, LinkedIn, and direct link sharing
 */

import { useState, useCallback } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';

/**
 * Toast notification utility (assumed to exist in app)
 * Falls back to console if not available
 */
function showToast(message: string, type: string = 'info'): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).toast && typeof (window as any).toast === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).toast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Copy text to clipboard with feedback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

interface ShareOptions {
  includeProfile?: boolean;
  message?: string;
}

interface ShareData {
  shareToken: string;
  shareUrl: string;
  previewUrl?: string;
  platform: string;
  trackingId: string;
  expiresAt: string;
  expiresIn: number;
}

/**
 * useSocialShare Hook
 * @param {string} recognitionId - Recognition ID to share
 * @returns {object} Share state and methods
 */
export function useSocialShare(recognitionId: string) {
  const auth = useAuth();
  const user = auth && typeof auth === 'object' && '$id' in auth ? auth : null;
  const i18n = useI18n('social_share');
  const t = (key: string, vars?: Record<string, unknown>) => 
    typeof i18n === 'string' ? i18n : i18n?.[key] || key;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  /**
   * Create a share for the given platform
   */
  const createShare = useCallback(
    async (platform: string, options: ShareOptions = {}) => {
      if (!recognitionId || !user) {
        setError('Recognition or user not found');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/social-share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'x-user-id': (user as { $id: string }).$id,
          },
          body: JSON.stringify({
            recognitionId,
            platform,
            includeProfile: options.includeProfile || false,
            message: options.message || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || 'Failed to create share');
        }

        const result = await response.json() as { data: ShareData };
        setShareData(result.data);
        return result.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to share recognition';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [recognitionId, user]
  );

  /**
   * Track a share interaction
   */
  const trackShare = useCallback(
    async (shareToken: string, action: string = 'VIEW') => {
      try {
        const response = await fetch('/api/track-share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareToken,
            action,
          }),
        });

        if (!response.ok) {
          console.warn('Failed to track share:', response.statusText);
          return null;
        }

        return await response.json();
      } catch (err) {
        console.error('Share tracking error:', err);
        return null;
      }
    },
    []
  );

  /**
   * Share to Slack
   */
  const shareToSlack = useCallback(
    async (options: ShareOptions = {}) => {
      const share = await createShare('SLACK', {
        includeProfile: true,
        ...options,
      });

      if (share) {
        showToast(t('slack_copied'), 'success');
        await copyToClipboard(share.shareUrl);
      }

      return share;
    },
    [createShare, t]
  );

  /**
   * Share to Teams
   */
  const shareToTeams = useCallback(
    async (options: ShareOptions = {}) => {
      const share = await createShare('TEAMS', {
        includeProfile: true,
        ...options,
      });

      if (share) {
        showToast(t('teams_copied'), 'success');
        await copyToClipboard(share.shareUrl);
      }

      return share;
    },
    [createShare, t]
  );

  /**
   * Share to LinkedIn
   */
  const shareToLinkedIn = useCallback(
    async (options: ShareOptions = {}) => {
      const share = await createShare('LINKEDIN', {
        includeProfile: true,
        ...options,
      });

      if (share) {
        // For LinkedIn, open native share dialog
        const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(share.shareUrl)}`;
        window.open(linkedInUrl, 'linkedin-share', 'width=550,height=680');
        showToast(t('linkedin_opened'), 'success');
      }

      return share;
    },
    [createShare, t]
  );

  /**
   * Copy shareable link to clipboard
   */
  const copyLink = useCallback(
    async (options: ShareOptions = {}) => {
      const share = await createShare('LINK', options);

      if (share) {
        const copied = await copyToClipboard(share.shareUrl);
        if (copied) {
          showToast(t('link_copied'), 'success');
        } else {
          showToast(t('copy_failed'), 'error');
        }
      }

      return share;
    },
    [createShare, t]
  );

  /**
   * Get share stats (views, clicks, reactions)
   */
  const getShareStats = useCallback(
    async (shareToken: string) => {
      if (!shareToken) return null;

      try {
        const response = await fetch(`/api/share-stats/${shareToken}`);
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        console.error('Failed to fetch share stats:', error);
        return null;
      }
    },
    []
  );

  /**
   * Reset share state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setShareData(null);
  }, []);

  return {
    loading,
    error,
    share: shareData,
    shareToSlack,
    shareToTeams,
    shareToLinkedIn,
    copyLink,
    trackShare,
    getShareStats,
    reset,
  };
}

export default useSocialShare;
