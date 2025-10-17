// Admin Dashboard - Abuse Monitoring and User Management
import React, { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { getDatabase, getFunctions } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface AbuseFlag {
  $id: string;
  recognitionId: string;
  flagType: 'RECIPROCITY' | 'FREQUENCY' | 'CONTENT' | 'EVIDENCE' | 'MANUAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  flaggedBy: 'SYSTEM' | 'USER' | 'ADMIN';
  flaggedAt: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  recognition: {
    giverEmail: string;
    recipientEmail: string;
    reason: string;
    weight: number;
    tags: string[];
    createdAt: string;
  };
}

interface UserSummary {
  $id: string;
  email: string;
  name: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  stats: {
    recognitionsGiven: number;
    recognitionsReceived: number;
    flagCount: number;
    lastActive: string;
  };
  riskScore: number;
}

export function AdminDashboard(): React.ReactElement {
  const { currentUser, isAdmin } = useAuth();
  const [abuseFlags, setAbuseFlags] = useState<AbuseFlag[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flags' | 'users' | 'analytics'>('flags');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'REVIEWED' | 'RESOLVED'>('ALL');
  const [selectedFlag, setSelectedFlag] = useState<AbuseFlag | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const databases = getDatabase();
  const functions = getFunctions();

  // Load abuse flags and user data
  const loadDashboardData = async () => {
    try {
      if (!currentUser || !isAdmin()) {
        setError('Admin access required');
        setLoading(false);
        return;
      }

      // Get abuse flags
      const flagsResponse = await databases.listDocuments(
        'main',
        'abuse_flags',
        [Query.orderDesc('flaggedAt')]
      );

      // Get user summaries  
      const usersResponse = await databases.listDocuments(
        'main',
        'user_summaries',
        [Query.orderDesc('riskScore')]
      );

      const flagsData = await Promise.all(
        flagsResponse.documents.map(async (doc) => {
          // Get recognition details
          try {
            const recognitionResponse = await databases.getDocument(
              'main',
              'recognitions',
              doc.recognitionId
            );

            return {
              $id: doc.$id,
              recognitionId: doc.recognitionId,
              flagType: doc.flagType,
              severity: doc.severity,
              description: doc.description,
              flaggedBy: doc.flaggedBy,
              flaggedAt: doc.flaggedAt,
              status: doc.status,
              reviewedBy: doc.reviewedBy,
              reviewedAt: doc.reviewedAt,
              reviewNotes: doc.reviewNotes,
              recognition: {
                giverEmail: recognitionResponse.giverEmail,
                recipientEmail: recognitionResponse.recipientEmail,
                reason: recognitionResponse.reason,
                weight: recognitionResponse.weight || 1,
                tags: recognitionResponse.tags || [],
                createdAt: recognitionResponse.createdAt
              }
            } as AbuseFlag;
          } catch (err) {
            // Handle case where recognition might be deleted
            return {
              $id: doc.$id,
              recognitionId: doc.recognitionId,
              flagType: doc.flagType,
              severity: doc.severity,
              description: doc.description,
              flaggedBy: doc.flaggedBy,
              flaggedAt: doc.flaggedAt,
              status: doc.status,
              reviewedBy: doc.reviewedBy,
              reviewedAt: doc.reviewedAt,
              reviewNotes: doc.reviewNotes,
              recognition: {
                giverEmail: 'Unknown',
                recipientEmail: 'Unknown', 
                reason: 'Recognition deleted',
                weight: 1,
                tags: [],
                createdAt: doc.flaggedAt
              }
            } as AbuseFlag;
          }
        })
      );

      const usersData = usersResponse.documents.map(doc => ({
        $id: doc.$id,
        email: doc.email,
        name: doc.name || 'Unknown User',
        role: doc.role || 'USER',
        status: doc.status || 'ACTIVE',
        stats: doc.stats || {
          recognitionsGiven: 0,
          recognitionsReceived: 0,
          flagCount: 0,
          lastActive: new Date().toISOString()
        },
        riskScore: doc.riskScore || 0
      })) as UserSummary[];

      setAbuseFlags(flagsData);
      setUsers(usersData);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Review abuse flag
  const reviewFlag = async (flagId: string, action: 'RESOLVE' | 'DISMISS', note: string) => {
    try {
      setProcessingIds(prev => new Set([...prev, flagId]));

      const response = await functions.createExecution(
        'admin-review-flag',
        JSON.stringify({
          flagId,
          action,
          reviewNotes: note,
          reviewedBy: currentUser?.$id
        })
      );

      const result = JSON.parse(response.responseBody || '{}');

      if (result.success) {
        // Update local state
        setAbuseFlags(prev =>
          prev.map(flag =>
            flag.$id === flagId
              ? {
                  ...flag,
                  status: action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED',
                  reviewedBy: currentUser?.$id || '',
                  reviewedAt: new Date().toISOString(),
                  reviewNotes: note
                }
              : flag
          )
        );

        // Success feedback
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `Flag ${action.toLowerCase()}d successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);

        setShowReviewModal(false);
        setSelectedFlag(null);
        setReviewNote('');
      } else {
        throw new Error(result.error || 'Review action failed');
      }
    } catch (err) {
      console.error('Flag review failed:', err);
    } finally {
      setProcessingIds(prev => {
        const updated = new Set(prev);
        updated.delete(flagId);
        return updated;
      });
    }
  };

  // Update user status
  const updateUserStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    try {
      const response = await functions.createExecution(
        'admin-update-user-status',
        JSON.stringify({
          userId,
          status,
          updatedBy: currentUser?.$id
        })
      );

      const result = JSON.parse(response.responseBody || '{}');

      if (result.success) {
        // Update local state
        setUsers(prev =>
          prev.map(user =>
            user.$id === userId ? { ...user, status } : user
          )
        );
      } else {
        throw new Error(result.error || 'Status update failed');
      }
    } catch (err) {
      console.error('User status update failed:', err);
    }
  };

  // Filter functions
  const filteredFlags = abuseFlags.filter(flag => {
    if (filterSeverity !== 'ALL' && flag.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && flag.status !== filterStatus) return false;
    return true;
  });

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get risk score color
  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  if (!currentUser || !isAdmin()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-red-700">Admin permissions required to access the dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Monitor system abuse, manage users, and review flags</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Pending Flags</h3>
          <p className="text-3xl font-bold text-red-600">
            {abuseFlags.filter(f => f.status === 'PENDING').length}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Critical Issues</h3>
          <p className="text-3xl font-bold text-orange-600">
            {abuseFlags.filter(f => f.severity === 'CRITICAL').length}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">High Risk Users</h3>
          <p className="text-3xl font-bold text-yellow-600">
            {users.filter(u => u.riskScore >= 70).length}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Suspended Users</h3>
          <p className="text-3xl font-bold text-purple-600">
            {users.filter(u => u.status === 'SUSPENDED').length}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('flags')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'flags'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Abuse Flags ({abuseFlags.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Management ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'flags' && (
            <div>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <label htmlFor="severity-filter" className="text-sm font-medium text-gray-700">
                    Severity:
                  </label>
                  <select
                    id="severity-filter"
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    aria-label="Filter flags by severity level"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
                    Status:
                  </label>
                  <select
                    id="status-filter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    aria-label="Filter flags by review status"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Flags List */}
              <div className="space-y-4">
                {filteredFlags.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No abuse flags match the current filters.</p>
                  </div>
                ) : (
                  filteredFlags.map((flag) => (
                    <div key={flag.$id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            getSeverityColor(flag.severity)
                          }`}>
                            {flag.severity}
                          </span>
                          <div>
                            <h4 className="font-medium text-gray-900">{flag.flagType.replace('_', ' ')}</h4>
                            <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                            <div className="text-xs text-gray-500 mt-2">
                              Flagged by {flag.flaggedBy} • {formatRelativeTime(flag.flaggedAt)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            flag.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            flag.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {flag.status}
                          </span>

                          {flag.status === 'PENDING' && (
                            <button
                              onClick={() => {
                                setSelectedFlag(flag);
                                setShowReviewModal(true);
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Recognition Details */}
                      <div className="bg-gray-50 rounded-md p-3 mt-3">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 mb-1">
                            {flag.recognition.giverEmail} → {flag.recognition.recipientEmail}
                          </div>
                          <p className="text-gray-700 mb-2">{flag.recognition.reason}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Weight: {flag.recognition.weight}x</span>
                            {flag.recognition.tags.length > 0 && (
                              <span>Tags: {flag.recognition.tags.join(', ')}</span>
                            )}
                            <span>{formatRelativeTime(flag.recognition.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statistics
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.$id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                            user.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getRiskScoreColor(user.riskScore)}`}>
                            {user.riskScore}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>Given: {user.stats.recognitionsGiven}</div>
                          <div>Received: {user.stats.recognitionsReceived}</div>
                          <div>Flags: {user.stats.flagCount}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            {user.status === 'ACTIVE' && (
                              <button
                                onClick={() => updateUserStatus(user.$id, 'SUSPENDED')}
                                className="text-yellow-600 hover:text-yellow-900"
                              >
                                Suspend
                              </button>
                            )}
                            {user.status === 'SUSPENDED' && (
                              <>
                                <button
                                  onClick={() => updateUserStatus(user.$id, 'ACTIVE')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Activate
                                </button>
                                <button
                                  onClick={() => updateUserStatus(user.$id, 'BANNED')}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Ban
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div>
              <div className="text-center py-8 text-gray-500">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
                <p>Detailed analytics and reporting features coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedFlag && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Review Abuse Flag
              </h3>

              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    getSeverityColor(selectedFlag.severity)
                  }`}>
                    {selectedFlag.severity}
                  </span>
                  <span className="text-sm font-medium">{selectedFlag.flagType}</span>
                </div>
                <p className="text-sm text-gray-700 mb-3">{selectedFlag.description}</p>
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {selectedFlag.recognition.giverEmail} → {selectedFlag.recognition.recipientEmail}
                  </div>
                  <p className="text-sm text-gray-700">{selectedFlag.recognition.reason}</p>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="review-note" className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (Required)
                </label>
                <textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Explain your decision and any actions taken..."
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedFlag(null);
                    setReviewNote('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => reviewFlag(selectedFlag.$id, 'DISMISS', reviewNote)}
                  disabled={!reviewNote.trim() || processingIds.has(selectedFlag.$id)}
                  className="flex-1 px-4 py-2 border border-yellow-600 text-yellow-600 rounded-md hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => reviewFlag(selectedFlag.$id, 'RESOLVE', reviewNote)}
                  disabled={!reviewNote.trim() || processingIds.has(selectedFlag.$id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}