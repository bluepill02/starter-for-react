// Recognition Feed with infinite scroll - Production Implementation
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface Recognition {
  $id: string;
  giverUserId: string;
  giverName: string;
  giverEmail: string;
  recipientEmail: string;
  tags: string[];
  reason: string;
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  evidenceIds: string[];
  weight: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verificationNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface FeedFilters {
  visibility: 'ALL' | 'PUBLIC' | 'TEAM' | 'PRIVATE';
  status: 'ALL' | 'VERIFIED' | 'PENDING';
  timeRange: '7d' | '30d' | '90d' | 'all';
  tags: string[];
}

const ITEMS_PER_PAGE = 20;

export function RecognitionFeed(): React.ReactElement {
  const { currentUser, isManager, isAdmin } = useAuth();
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FeedFilters>({
    visibility: 'ALL',
    status: 'ALL',
    timeRange: '30d',
    tags: []
  });
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);

  const databases = getDatabase();
  const observerRef = useRef<HTMLDivElement>(null);

  // Build query filters based on user permissions and filter settings
  const buildQueryFilters = useCallback(() => {
    const queries: string[] = [];
    
    // Time range filter
    if (filters.timeRange !== 'all') {
      const days = parseInt(filters.timeRange.replace('d', ''));
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      queries.push(`createdAt.greaterThan("${cutoffDate}")`);
    }

    // Visibility filter based on user role and selection
    if (filters.visibility === 'PUBLIC') {
      queries.push('visibility.equal("PUBLIC")');
    } else if (filters.visibility === 'TEAM') {
      queries.push('visibility.equal("TEAM")');
    } else if (filters.visibility === 'PRIVATE') {
      // Only show private recognitions involving the current user
      if (currentUser) {
        queries.push('visibility.equal("PRIVATE")');
        queries.push(`$or:[giverUserId.equal("${currentUser.$id}"),recipientEmail.equal("${currentUser.email}")]`);
      }
    } else {
      // ALL - show based on permissions
      if (isAdmin()) {
        // Admins see everything
      } else if (isManager()) {
        // Managers see public, team, and their private recognitions
        queries.push(`$or:[visibility.equal("PUBLIC"),visibility.equal("TEAM"),$and:[visibility.equal("PRIVATE"),$or:[giverUserId.equal("${currentUser?.$id}"),recipientEmail.equal("${currentUser?.email}")]]]`);
      } else {
        // Users see public and their private recognitions
        queries.push(`$or:[visibility.equal("PUBLIC"),$and:[visibility.equal("PRIVATE"),$or:[giverUserId.equal("${currentUser?.$id}"),recipientEmail.equal("${currentUser?.email}")]]]`);
      }
    }

    // Status filter
    if (filters.status === 'VERIFIED') {
      queries.push('status.equal("VERIFIED")');
    } else if (filters.status === 'PENDING') {
      queries.push('status.equal("PENDING")');
    }

    // Tag filters
    if (filters.tags.length > 0) {
      const tagQueries = filters.tags.map(tag => `tags.search("${tag}")`);
      queries.push(`$or:[${tagQueries.join(',')}]`);
    }

    return queries;
  }, [filters, currentUser, isAdmin, isManager]);

  // Load initial recognitions
  const loadRecognitions = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setRecognitions([]);
        setLastDocumentId(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const queries = buildQueryFilters();
      
      // Add pagination
      if (lastDocumentId && !reset) {
        queries.push(`$id.greaterThan("${lastDocumentId}")`);
      }

      const response = await databases.listDocuments(
        'main',
        'recognitions',
        queries
      );

      const newRecognitions = response.documents as unknown as Recognition[];
      
      // Check if there are more items
      const hasMoreItems = newRecognitions.length > ITEMS_PER_PAGE;
      if (hasMoreItems) {
        newRecognitions.pop(); // Remove the extra item
      }

      if (reset) {
        setRecognitions(newRecognitions);
      } else {
        setRecognitions(prev => [...prev, ...newRecognitions]);
      }

      setHasMore(hasMoreItems);
      
      if (newRecognitions.length > 0) {
        setLastDocumentId(newRecognitions[newRecognitions.length - 1].$id);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load recognitions:', err);
      setError('Failed to load recognitions');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQueryFilters, lastDocumentId, databases]);

  // Initial load
  useEffect(() => {
    loadRecognitions(true);
  }, [filters]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadRecognitions(false);
        }
      },
      { threshold: 1.0 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadRecognitions]);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'text-green-600 bg-green-50';
      case 'PENDING': return 'text-yellow-600 bg-yellow-50';
      case 'REJECTED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof FeedFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Recognition Feed</h1>
        <p className="text-gray-600">
          Celebrate achievements and recognize outstanding contributions across your organization.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Filter Recognitions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Visibility Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visibility
            </label>
            <select
              value={filters.visibility}
              onChange={(e) => handleFilterChange('visibility', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by visibility"
            >
              <option value="ALL">All</option>
              <option value="PUBLIC">Public</option>
              <option value="TEAM">Team</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by status"
            >
              <option value="ALL">All</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange('timeRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by time range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                visibility: 'ALL',
                status: 'ALL',
                timeRange: '30d',
                tags: []
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Recognition List */}
      <div className="space-y-6">
        {loading && recognitions.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading recognitions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => loadRecognitions(true)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : recognitions.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No recognitions found matching your filters.</p>
            <button
              onClick={() => setFilters({
                visibility: 'ALL',
                status: 'ALL',
                timeRange: 'all',
                tags: []
              })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          recognitions.map((recognition) => (
            <div key={recognition.$id} className="bg-white rounded-lg shadow-sm border p-6">
              {/* Recognition Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {recognition.giverName}
                    </span>
                    <span className="text-gray-500">recognized</span>
                    <span className="font-medium text-blue-600">
                      {recognition.recipientEmail}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <time>{formatRelativeTime(recognition.createdAt)}</time>
                    <span>•</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(recognition.status)}`}>
                      {recognition.status}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{recognition.visibility.toLowerCase()}</span>
                    {recognition.weight > 1 && (
                      <>
                        <span>•</span>
                        <span className="text-orange-600 font-medium">
                          {recognition.weight}x weight
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {recognition.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {recognition.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Recognition Reason */}
              <div className="mb-4">
                <p className="text-gray-800 leading-relaxed">{recognition.reason}</p>
              </div>

              {/* Evidence Indicator */}
              {recognition.evidenceIds.length > 0 && (
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
                  <span>📎</span>
                  <span>{recognition.evidenceIds.length} evidence file(s) attached</span>
                </div>
              )}

              {/* Verification Info */}
              {recognition.status === 'VERIFIED' && recognition.verifiedBy && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                  <div className="flex items-center gap-2 text-green-800">
                    <span>✓</span>
                    <span>Verified by manager</span>
                  </div>
                  {recognition.verificationNote && (
                    <p className="mt-1 text-green-700">{recognition.verificationNote}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Infinite Scroll Observer */}
        <div ref={observerRef} className="h-4" />

        {/* End of Results */}
        {!hasMore && recognitions.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>You've reached the end of the recognition feed.</p>
          </div>
        )}
      </div>
    </div>
  );
}