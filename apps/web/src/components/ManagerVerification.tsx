// Manager Verification System - Approval Workflow for High-Value Recognitions
import React, { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { getDatabase, getFunctions } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface PendingRecognition {
  $id: string;
  giverUserId: string;
  giverName: string;
  giverEmail: string;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  tags: string[];
  reason: string;
  weight: number;
  evidenceIds: string[];
  evidenceCount: number;
  createdAt: string;
  requiresVerification: boolean;
  verificationReason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Interface for future verification actions  
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface VerificationAction {
  recognitionId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  note: string;
}

export function ManagerVerification(): React.ReactElement {
  const { currentUser, isManager, isAdmin } = useAuth();
  const [pendingRecognitions, setPendingRecognitions] = useState<PendingRecognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [selectedRecognition, setSelectedRecognition] = useState<PendingRecognition | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | 'REQUEST_INFO' | null>(null);

  const databases = getDatabase();
  const functions = getFunctions();

  // Load pending recognitions that need manager verification
  const loadPendingRecognitions = async () => {
    try {
      setLoading(true);
      
      if (!currentUser || (!isManager() && !isAdmin())) {
        setError('Access denied - Manager permissions required');
        setLoading(false);
        return;
      }

      // Get recognitions pending verification
      // In production, this would filter by team/department assignments
      const response = await databases.listDocuments(
        'main',
        'recognitions',
        [
          Query.equal('status', 'PENDING'),
          Query.equal('requiresVerification', true),
          Query.orderDesc('createdAt')
        ]
      );

      const recognitions = response.documents.map(doc => {
        const evidence = doc.evidenceIds || [];
        return {
          $id: doc.$id,
          giverUserId: doc.giverUserId,
          giverName: doc.giverName || 'Unknown User',
          giverEmail: doc.giverEmail,
          recipientUserId: doc.recipientUserId,
          recipientName: doc.recipientName || 'Unknown User', 
          recipientEmail: doc.recipientEmail,
          tags: doc.tags || [],
          reason: doc.reason,
          weight: doc.weight || 1,
          evidenceIds: evidence,
          evidenceCount: evidence.length,
          createdAt: doc.createdAt,
          requiresVerification: doc.requiresVerification,
          verificationReason: doc.verificationReason || 'High-value recognition requires approval',
          priority: doc.priority || 'MEDIUM'
        } as PendingRecognition;
      });

      setPendingRecognitions(recognitions);
      setError(null);
    } catch (err) {
      console.error('Failed to load pending recognitions:', err);
      setError('Failed to load pending recognitions');
    } finally {
      setLoading(false);
    }
  };

  // Handle verification action
  const handleVerification = async (action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') => {
    if (!selectedRecognition) return;

    setPendingAction(action);
    setShowVerificationModal(true);
  };

  // Execute verification action
  const executeVerification = async () => {
    if (!selectedRecognition || !pendingAction) return;

    try {
      setProcessingIds(prev => new Set([...prev, selectedRecognition.$id]));

      const verificationData = {
        recognitionId: selectedRecognition.$id,
        action: pendingAction,
        verifierUserId: currentUser?.$id,
        verifierEmail: currentUser?.email,
        verificationNote: verificationNote.trim(),
        timestamp: new Date().toISOString()
      };

      const response = await functions.createExecution(
        'verify-recognition',
        JSON.stringify(verificationData)
      );

      const result = JSON.parse(response.responseBody || '{}');

      if (result.success) {
        // Remove from pending list if approved or rejected
        if (pendingAction === 'APPROVE' || pendingAction === 'REJECT') {
          setPendingRecognitions(prev => 
            prev.filter(r => r.$id !== selectedRecognition.$id)
          );
        }

        // Success announcement
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `Recognition ${pendingAction.toLowerCase()}d successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);

        // Reset modal state
        setShowVerificationModal(false);
        setSelectedRecognition(null);
        setVerificationNote('');
        setPendingAction(null);
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Verification failed:', err);
      
      // Error announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Verification failed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
    } finally {
      setProcessingIds(prev => {
        const updated = new Set(prev);
        updated.delete(selectedRecognition.$id);
        return updated;
      });
    }
  };

  // Filter recognitions by priority
  const filteredRecognitions = pendingRecognitions.filter(recognition => {
    if (filterPriority === 'ALL') return true;
    return recognition.priority === filterPriority;
  });

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return diffInMinutes + ' minutes ago';
    if (diffInMinutes < 1440) return Math.floor(diffInMinutes / 60) + ' hours ago';
    return Math.floor(diffInMinutes / 1440) + ' days ago';
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    loadPendingRecognitions();
  }, [currentUser]);

  if (!currentUser || (!isManager() && !isAdmin())) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-red-700">Manager or Admin permissions required to access this page.</p>
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
            <p className="text-gray-600">Loading pending verifications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manager Verification</h1>
        <p className="text-gray-600">
          Review and approve high-value recognitions that require manager verification
        </p>
      </div>

      {/* Stats and Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6 mb-4 sm:mb-0">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{pendingRecognitions.length}</div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {pendingRecognitions.filter(r => r.priority === 'HIGH').length}
                </div>
                <div className="text-sm text-gray-500">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {pendingRecognitions.reduce((sum, r) => sum + r.weight, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Weight</div>
              </div>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="priority-filter" className="text-sm font-medium text-gray-700">
                Filter by Priority:
              </label>
              <select
                id="priority-filter"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white"
                aria-label="Filter recognitions by priority level"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadPendingRecognitions}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Recognition List */}
      <div className="space-y-6">
        {filteredRecognitions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Verifications</h3>
            <p className="text-gray-600">
              {filterPriority === 'ALL' 
                ? 'All recognitions have been processed.'
                : `No ${filterPriority.toLowerCase()} priority recognitions pending verification.`
              }
            </p>
          </div>
        ) : (
          filteredRecognitions.map((recognition) => (
            <div key={recognition.$id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getPriorityColor(recognition.priority)
                      }`}>
                        {recognition.priority} PRIORITY
                      </span>
                      {recognition.weight > 1 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {recognition.weight}x Weight
                        </span>
                      )}
                      {recognition.evidenceCount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          📎 {recognition.evidenceCount} Evidence
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {recognition.giverName} → {recognition.recipientName}
                    </h3>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <span>{recognition.giverEmail}</span> recognizing <span>{recognition.recipientEmail}</span>
                      <span className="mx-2">•</span>
                      <span>{formatRelativeTime(recognition.createdAt)}</span>
                    </div>

                    {/* Tags */}
                    {recognition.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {recognition.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Recognition Text */}
                    <p className="text-gray-800 mb-4 leading-relaxed">{recognition.reason}</p>

                    {/* Verification Reason */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-yellow-800">Requires Verification</h4>
                          <p className="text-sm text-yellow-700 mt-1">{recognition.verificationReason}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setSelectedRecognition(recognition);
                      handleVerification('APPROVE');
                    }}
                    disabled={processingIds.has(recognition.$id)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {processingIds.has(recognition.$id) ? 'Processing...' : 'Approve'}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRecognition(recognition);
                      handleVerification('REQUEST_INFO');
                    }}
                    disabled={processingIds.has(recognition.$id)}
                    className="flex-1 px-4 py-2 border border-yellow-600 text-yellow-600 rounded-md hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Request Info
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRecognition(recognition);
                      handleVerification('REJECT');
                    }}
                    disabled={processingIds.has(recognition.$id)}
                    className="flex-1 px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Verification Modal */}
      {showVerificationModal && selectedRecognition && pendingAction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {pendingAction === 'APPROVE' ? 'Approve Recognition' :
                 pendingAction === 'REJECT' ? 'Reject Recognition' :
                 'Request Additional Information'}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {selectedRecognition.giverName} → {selectedRecognition.recipientName}
                </p>
                <p className="text-sm text-gray-600 truncate">{selectedRecognition.reason}</p>
              </div>

              <div className="mb-6">
                <label htmlFor="verification-note" className="block text-sm font-medium text-gray-700 mb-2">
                  {pendingAction === 'APPROVE' ? 'Approval Note (Optional)' :
                   pendingAction === 'REJECT' ? 'Rejection Reason (Required)' :
                   'Information Request (Required)'}
                </label>
                <textarea
                  id="verification-note"
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    pendingAction === 'APPROVE' ? 'Optional note about your approval...' :
                    pendingAction === 'REJECT' ? 'Please explain why this recognition is being rejected...' :
                    'Please specify what additional information is needed...'
                  }
                  required={pendingAction !== 'APPROVE'}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowVerificationModal(false);
                    setSelectedRecognition(null);
                    setVerificationNote('');
                    setPendingAction(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeVerification}
                  disabled={pendingAction !== 'APPROVE' && !verificationNote.trim()}
                  className={`flex-1 px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    pendingAction === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' :
                    pendingAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {pendingAction === 'APPROVE' ? 'Approve' :
                   pendingAction === 'REJECT' ? 'Reject' :
                   'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}