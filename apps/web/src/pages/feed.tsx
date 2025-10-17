// Recognition Feed Page - Infinite scroll with optimistic UI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { getDatabase, getFunctions } from '../appwrite/client';
import { Query } from 'appwrite';

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
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = `Recognition ${verified ? 'verified' : 'rejected'} successfully`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
      
    } catch (error) {
      console.error('Failed to verify recognition:', error);
      
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Failed to verify recognition';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
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
  
  // Recognition card component
  const RecognitionCard = ({ recognition }: { recognition: Recognition }) => {
    const isOwn = recognition.giverEmail === currentUser?.email || recognition.recipientEmail === currentUser?.email;
    const canVerify = hasPermission('manager') && recognition.status === 'PENDING';
    
    return (
      <div 
        className={`bg-white rounded-lg border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${
          recognition.isOptimistic ? 'opacity-70 border-blue-200 bg-blue-50' : ''
        } ${recognition.error ? 'border-red-200 bg-red-50' : ''}`}
      >
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            {recognition.giverName.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <span className="font-medium text-gray-900">{recognition.giverName}</span>
              <span>recognized</span>
              <span className="font-medium text-gray-900">{recognition.recipientEmail}</span>
              <span>•</span>
              <time dateTime={recognition.createdAt}>
                {new Date(recognition.createdAt).toLocaleDateString()}
              </time>
              {recognition.isOptimistic && (
                <span className="text-blue-600 text-xs">Sending...</span>
              )}
            </div>
            
            {/* Reason */}
            <p className="text-gray-900 mb-3 leading-relaxed">{recognition.reason}</p>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {recognition.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                </span>
              ))}
            </div>
            
            {/* Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <span className="font-medium">Weight:</span>
                  <span className="ml-1">{recognition.weight}</span>
                </span>
                
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  recognition.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                  recognition.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {recognition.status.toLowerCase()}
                </span>
                
                {recognition.visibility !== 'PUBLIC' && (
                  <span className="flex items-center text-gray-400">
                    🔒 {recognition.visibility.toLowerCase()}
                  </span>
                )}
              </div>
              
              {/* Manager verification controls */}
              {canVerify && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleVerifyRecognition(recognition.$id, true)}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                    aria-label={`Verify recognition from ${recognition.giverName}`}
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => handleVerifyRecognition(recognition.$id, false, 'Requires additional review')}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                    aria-label={`Reject recognition from ${recognition.giverName}`}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
            
            {/* Verification details */}
            {recognition.verifiedBy && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="text-sm">
                  <span className="text-gray-600">Verified by:</span>
                  <span className="ml-1 font-medium">{recognition.verifiedBy}</span>
                </div>
                {recognition.verificationNote && (
                  <p className="text-sm text-gray-600 mt-1">{recognition.verificationNote}</p>
                )}
              </div>
            )}
            
            {/* Error display for optimistic updates */}
            {recognition.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{recognition.error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Combine all recognitions (optimistic + real)
  const allRecognitions = [...state.optimisticRecognitions, ...state.recognitions];
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Recognition Feed</h1>
          <p className="text-gray-600">See the latest recognitions in your organization</p>
        </div>
        
        {/* Error state */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600" role="alert">{state.error}</p>
            <button
              onClick={() => loadRecognitions(true)}
              className="mt-2 text-red-700 hover:text-red-800 text-sm font-medium"
            >
              Try again
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
              <RecognitionCard recognition={recognition} />
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
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🎉</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recognitions yet</h3>
              <p className="text-gray-600">Be the first to recognize someone's great work!</p>
            </div>
          )}
          
          {/* End of results */}
          {!state.loading && !state.hasMore && allRecognitions.length > 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">You've reached the end of the feed</p>
            </div>
          )}
        </div>
      </div>
      
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