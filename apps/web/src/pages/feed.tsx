// Recognition Feed Page - Two-column layout with infinite scroll
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { getDatabase, getFunctions } from '../appwrite/client';
import { Query } from 'appwrite';
import { announcePolite, announceAssertive } from '../lib/liveRegion';
import { useI18n } from '../lib/i18n';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts';
import RecognitionCard from '../components/RecognitionCard';
import PersonalSnapshot from '../components/PersonalSnapshot';
import QuickActions from '../components/QuickActions';
import ManagerNudges from '../components/ManagerNudges';
import EmptyState from '../components/EmptyState';

interface Recognition {
  $id: string;
  giverName: string;
  giverEmail: string;
  recipientEmail: string;
  tags: string[];
  reason: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  weight: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verificationNote?: string;
  createdAt: string;
  updatedAt: string;
  isOptimistic?: boolean; // For optimistic UI updates
  error?: string; // For error display in optimistic UI
}

interface FeedState {
  recognitions: Recognition[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  optimisticRecognitions: Recognition[];
}

const ITEMS_PER_PAGE = 20;
const SKELETON_COUNT = 6;

export default function FeedPage(): React.ReactElement {
  const maskEmail = (email: string): string => {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const maskedLocal = local.length <= 2 ? local[0] + '*' : local[0] + '*'.repeat(Math.max(1, local.length - 2)) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  };
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);
  const { currentUser } = useAuth();
  const databases = getDatabase();
  const functions = getFunctions();
  
  // Simple role checker (since hasPermission doesn't exist)
  const hasPermission = (role: string) => {
    const userRole = currentUser?.role || 'USER';
    if (role === 'admin') return userRole === 'ADMIN';
    if (role === 'manager') return userRole === 'MANAGER' || userRole === 'ADMIN';
    return true;
  };
  
  const [state, setState] = useState<FeedState>({
    recognitions: [],
    loading: true,
    hasMore: true,
    error: null,
    optimisticRecognitions: []
  });
  
  const [offset, setOffset] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastRecognitionElementRef = useRef<HTMLDivElement>(null);
  
  // Reject confirmation modal state and focus handling
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const rejectModalRef = useRef<HTMLDivElement>(null);
  const rejectTextareaRef = useRef<HTMLTextAreaElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const openRejectModal = (id: string) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectError(null);
    prevFocusRef.current = (document.activeElement as HTMLElement) || null;
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setRejectSubmitting(false);
    setRejectError(null);
    if (prevFocusRef.current) prevFocusRef.current.focus();
  };

  useEffect(() => {
    if (rejectModalOpen) {
      // focus first field
      setTimeout(() => rejectTextareaRef.current?.focus(), 0);
    }
  }, [rejectModalOpen]);

  const onRejectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeRejectModal();
    }
    if (e.key === 'Tab') {
      const container = rejectModalRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const submitReject = async () => {
    if (!rejectTargetId) return;
    const reason = rejectReason.trim();
    if (reason.length === 0) {
      setRejectError('A reason is required to reject a recognition');
      announceAssertive('Rejection cancelled: reason is required', 1500);
      return;
    }
    try {
      setRejectSubmitting(true);
      await handleVerifyRecognition(rejectTargetId, false, reason);
      closeRejectModal();
    } catch (err) {
      setRejectSubmitting(false);
      setRejectError(err instanceof Error ? err.message : 'Failed to reject recognition');
      announceAssertive('Failed to reject recognition', 2000);
    }
  };
  
  // Load recognitions with pagination
  const loadRecognitions = useCallback(async (isInitial = false) => {
    if (!currentUser || state.loading) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const currentOffset = isInitial ? 0 : offset;
      
      // Build queries based on user permissions and visibility
      const queries = [
        Query.orderDesc('createdAt'),
        Query.limit(ITEMS_PER_PAGE),
        Query.offset(currentOffset)
      ];
      
      // Filter by visibility based on user role
      if (!hasPermission('admin')) {
        if (hasPermission('manager')) {
          // Managers see team and public recognitions
          queries.push(Query.or([
            Query.equal('visibility', 'TEAM'),
            Query.equal('visibility', 'PUBLIC'),
            Query.equal('giverEmail', currentUser.email),
            Query.equal('recipientEmail', currentUser.email)
          ]));
        } else {
          // Regular users see public and their own
          queries.push(Query.or([
            Query.equal('visibility', 'PUBLIC'),
            Query.equal('giverEmail', currentUser.email),
            Query.equal('recipientEmail', currentUser.email)
          ]));
        }
      }
      
      const response = await databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        'recognitions',
        queries
      );
      
      const newRecognitions = response.documents as unknown as Recognition[];
      const hasMore = newRecognitions.length === ITEMS_PER_PAGE;
      
      setState(prev => ({
        ...prev,
        recognitions: isInitial ? newRecognitions : [...prev.recognitions, ...newRecognitions],
        loading: false,
        hasMore,
        error: null
      }));
      
      setOffset(isInitial ? ITEMS_PER_PAGE : currentOffset + ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Failed to load recognitions:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load recognitions',
        hasMore: false
      }));
    }
  }, [currentUser, databases, offset, state.loading, hasPermission]);
  
  // Initial load
  useEffect(() => {
    if (currentUser) {
      loadRecognitions(true);
    }
  }, [currentUser]);
  
  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && state.hasMore && !state.loading) {
          loadRecognitions(false);
        }
      },
      { threshold: 0.1 }
    );
    
    if (lastRecognitionElementRef.current) {
      observerRef.current.observe(lastRecognitionElementRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadRecognitions, state.hasMore, state.loading]);
  
  // Optimistic UI: Add recognition immediately
  const addOptimisticRecognition = useCallback((recognition: Omit<Recognition, '$id' | 'isOptimistic'>) => {
    const optimisticRecognition: Recognition = {
      ...recognition,
      $id: `optimistic-${Date.now()}`,
      isOptimistic: true
    };
    
    setState(prev => ({
      ...prev,
      optimisticRecognitions: [optimisticRecognition, ...prev.optimisticRecognitions]
    }));
    
    return optimisticRecognition.$id;
  }, []);
  
  // Remove optimistic recognition (on success/error)
  const removeOptimisticRecognition = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      optimisticRecognitions: prev.optimisticRecognitions.filter(r => r.$id !== id)
    }));
  }, []);
  
  // Rollback optimistic recognition on error
  const rollbackOptimisticRecognition = useCallback((id: string, error: string) => {
    setState(prev => ({
      ...prev,
      optimisticRecognitions: prev.optimisticRecognitions.map(r => 
        r.$id === id 
          ? { ...r, error: error }
          : r
      )
    }));
    
    // Remove after showing error for 3 seconds
    setTimeout(() => removeOptimisticRecognition(id), 3000);
  }, [removeOptimisticRecognition]);
  
  // Manager verification action
  const handleVerifyRecognition = async (recognitionId: string, verified: boolean, note?: string) => {
    if (!hasPermission('manager')) return;
    
    try {
      await functions.createExecution(
        'verify-recognition',
        JSON.stringify({
          recognitionId,
          verified,
          verificationNote: note,
          verifierId: currentUser?.$id
        })
      );
      
      // Refresh the specific recognition
      setState(prev => ({
        ...prev,
        recognitions: prev.recognitions.map(r => 
          r.$id === recognitionId
            ? {
                ...r,
                status: verified ? 'VERIFIED' : 'REJECTED',
                verifiedBy: currentUser?.name,
                verificationNote: note
              }
            : r
        )
      }));
      
      // Announce to screen readers
      announcePolite(`Recognition ${verified ? 'verified' : 'rejected'} successfully`, 1500);
      
    } catch (error) {
      console.error('Failed to verify recognition:', error);
      announceAssertive('Failed to verify recognition', 2000);
    }
  };
  
  // Loading skeleton component
  const RecognitionSkeleton = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
            <div className="h-4 bg-gray-300 rounded w-16"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-full"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-6 bg-gray-300 rounded-full w-16"></div>
            <div className="h-6 bg-gray-300 rounded-full w-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Helper function to check if current user can verify a recognition
  const canVerifyRecognition = (recognition: Recognition) => {
    return hasPermission('manager') && recognition.status === 'PENDING';
  };

  // Keyboard shortcuts
  const handleNewRecognition = () => {
    console.log('Open new recognition modal'); // Would open RecognitionModal
    announcePolite(t('dashboard.new_recognition_shortcut_used'));
  };

  const handleSearch = () => {
    console.log('Focus search'); // Would focus search input
    announcePolite(t('dashboard.search_shortcut_used'));
  };

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        action: handleNewRecognition,
        description: t('dashboard.new_recognition')
      },
      {
        key: '/',
        action: handleSearch,
        description: t('dashboard.search')
      }
    ],
    enabled: true
  });
  
  // Combine all recognitions (optimistic + real)
  const allRecognitions = [...state.optimisticRecognitions, ...state.recognitions];
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left column - Main feed */}
          <div className="lg:col-span-3">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('dashboard.recognition_feed')}
              </h1>
              <p className="text-gray-600">
                {t('dashboard.feed_description')}
              </p>
            </div>
            
            {/* Error state */}
            {state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600" role="alert">{state.error}</p>
                <button
                  onClick={() => loadRecognitions(true)}
                  className="mt-2 text-red-700 hover:text-red-800 text-sm font-medium"
                >
                  {t('dashboard.try_again')}
                </button>
              </div>
            )}
            
            {/* Recognition list */}
            <div className="space-y-6">
              {allRecognitions.map((recognition, index) => (
                <div
                  key={recognition.$id}
                  ref={index === allRecognitions.length - 1 ? lastRecognitionElementRef : undefined}
                >
                  <RecognitionCard 
                    recognition={{
                      $id: recognition.$id,
                      giverId: recognition.giverEmail, // Using email as ID for now
                      giverName: recognition.giverName,
                      giverAvatar: undefined,
                      recipientId: recognition.recipientEmail, // Using email as ID for now
                      recipientName: recognition.recipientEmail, // Could be enhanced with actual name
                      recipientAvatar: undefined,
                      reason: recognition.reason,
                      tags: recognition.tags,
                      visibility: recognition.visibility,
                      weight: recognition.weight,
                      verified: recognition.status === 'VERIFIED',
                      verifierId: recognition.verifiedBy ? 'manager-id' : undefined,
                      verifierName: recognition.verifiedBy,
                      verificationNote: recognition.verificationNote,
                      verifiedAt: recognition.status === 'VERIFIED' ? recognition.updatedAt : undefined,
                      createdAt: recognition.createdAt,
                      updatedAt: recognition.updatedAt,
                      reactions: [], // Could be added from reactions data
                      commentsCount: 0 // Could be added from comments data
                    }}
                    onReact={() => {}}
                    onComment={() => {}}
                    onPublish={() => {}}
                    onShare={() => {}}
                    onEvidenceClick={() => {}}
                  />
                </div>
              ))}
              
              {/* Loading skeletons */}
              {state.loading && (
                <>
                  {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                    <RecognitionSkeleton key={`skeleton-${i}`} />
                  ))}
                </>
              )}
              
              {/* Empty state */}
              {!state.loading && allRecognitions.length === 0 && (
                <EmptyState
                  type="no_recognitions"
                  primaryAction={{
                    label: t('recognize.button'),
                    onClick: handleNewRecognition
                  }}
                  secondaryAction={{
                    label: t('dashboard.browse_team'),
                    onClick: () => console.log('Browse team')
                  }}
                />
              )}
              
              {/* End of results */}
              {!state.loading && !state.hasMore && allRecognitions.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {t('dashboard.end_of_feed')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column - Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Snapshot */}
            <PersonalSnapshot
              stats={{
                givenThisMonth: 0, // Demo data - connect to real API
                receivedThisMonth: 0,
                givenAllTime: 0,
                receivedAllTime: 0,
                engagementScore: 0
              }}
              recentActivity={[
                {
                  id: 'demo-1',
                  type: 'received',
                  otherPersonName: 'Demo User',
                  timeAgo: 'No activity yet'
                }
              ]}
            />

            {/* Quick Actions */}
            <QuickActions
              onNewRecognition={handleNewRecognition}
              onViewTemplates={() => {
                console.log('View templates');
              }}
              onInviteTeam={() => {
                console.log('Invite team');
              }}
              onViewAnalytics={() => {
                console.log('View analytics');
              }}
            />

            {/* Manager Nudges (only for managers) */}
            {hasPermission('manager') && (
              <ManagerNudges
                pendingVerifications={[
                  {
                    id: 'demo-1',
                    recognitionId: 'demo-rec1',
                    giver: { name: 'Demo Giver' },
                    recipient: { name: 'Demo Recipient' },
                    reason: 'Example recognition for demonstration purposes',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    urgency: 'low'
                  }
                ]}
                teamInsights={[
                  {
                    type: 'recognition_trend',
                    title: 'Getting Started',
                    description: 'Connect to your data source to see team insights',
                    actionLabel: 'Configure data'
                  }
                ]}
                onVerifyRecognition={(id) => {
                  console.log('Verify recognition:', id);
                }}
                onViewAllPending={() => {
                  console.log('View all pending');
                }}
                onTeamInsightAction={(insight) => {
                  console.log('Handle team insight:', insight);
                }}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Reject Confirmation Modal */}
      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          onKeyDown={onRejectKeyDown}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            aria-hidden="true"
            onClick={closeRejectModal}
          />
          {/* Modal Content */}
          <div
            ref={rejectModalRef}
            className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 id="reject-modal-title" className="text-lg font-semibold text-gray-900">Reject recognition</h2>
              <button
                type="button"
                onClick={closeRejectModal}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close reject modal"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700">
                Please provide a reason for rejection (required)
              </label>
              <textarea
                id="reject-reason"
                ref={rejectTextareaRef}
                className="w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Example: Insufficient evidence attached; please add a supporting link or file."
              />
              {rejectError && (
              <p className="text-sm text-red-600" role="alert">{rejectError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeRejectModal}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReject}
                disabled={rejectSubmitting}
                className={`px-4 py-2 rounded-md text-white ${rejectSubmitting ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {rejectSubmitting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expose functions for RecognitionModal integration */}
      <script dangerouslySetInnerHTML={{
        __html: `
          window.feedPageActions = {
            addOptimisticRecognition: ${addOptimisticRecognition},
            removeOptimisticRecognition: ${removeOptimisticRecognition}, 
            rollbackOptimisticRecognition: ${rollbackOptimisticRecognition}
          };
        `
      }} />
    </div>
  );
}