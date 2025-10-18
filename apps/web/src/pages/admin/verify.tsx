// Admin Verify - Recognition Verification Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { getDatabase, getFunctions } from '../../appwrite/client';
import { Query } from 'appwrite';

interface PendingRecognition {
  $id: string;
  giverName: string;
  giverEmail: string;
  recipientName: string;
  recipientEmail: string;
  reason: string;
  tags: string[];
  weight: number;
  originalWeight: number;
  evidenceIds: string[];
  createdAt: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  visibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  flagCount: number;
}

interface VerificationAction {
  recognitionId: string;
  action: 'VERIFY' | 'REJECT' | 'ADJUST_WEIGHT';
  justification: string;
  newWeight?: number;
  verifiedBy: string;
}

interface BulkAction {
  recognitionIds: string[];
  action: 'VERIFY' | 'REJECT';
  justification: string;
}

export default function VerifyPage(): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const t = useI18n;
  const databases = getDatabase();
  const functions = getFunctions();

  // State management
  const [recognitions, setRecognitions] = useState<PendingRecognition[]>([]);
  const [selectedRecognitions, setSelectedRecognitions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    status: 'PENDING',
    timeRange: '7d',
    hasFlags: 'ALL',
    weightRange: 'ALL'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  // Modal states
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedRecognition, setSelectedRecognition] = useState<PendingRecognition | null>(null);
  const [justification, setJustification] = useState('');
  const [newWeight, setNewWeight] = useState<number | undefined>();
  const [bulkAction, setBulkAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');

  // Access control
  if (!currentUser || !hasRole('MANAGER')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">🚫</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Manager access required for recognition verification.</p>
          </div>
        </div>
      </div>
    );
  }

  // Load pending recognitions
  const loadRecognitions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query filters
      const queryFilters = [Query.orderDesc('createdAt')];
      
      if (filters.status !== 'ALL') {
        queryFilters.push(Query.equal('status', filters.status));
      }

      // Date range filter
      if (filters.timeRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.timeRange) {
          case '1d':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        
        queryFilters.push(Query.greaterThanEqual('createdAt', startDate.toISOString()));
      }

      // Add pagination
      queryFilters.push(Query.limit(itemsPerPage));
      queryFilters.push(Query.offset((currentPage - 1) * itemsPerPage));

      const response = await databases.listDocuments(
        'main',
        'recognitions',
        queryFilters
      );

      const recognitionsData = response.documents.map(doc => ({
        $id: doc.$id,
        giverName: doc.giverName || 'Unknown',
        giverEmail: doc.giverEmail,
        recipientName: doc.recipientName || 'Unknown',
        recipientEmail: doc.recipientEmail,
        reason: doc.reason,
        tags: doc.tags || [],
        weight: doc.weight || 1,
        originalWeight: doc.originalWeight || doc.weight || 1,
        evidenceIds: doc.evidenceIds || [],
        createdAt: doc.createdAt,
        status: doc.status || 'PENDING',
        visibility: doc.visibility || 'PUBLIC',
        flagCount: doc.flagCount || 0
      })) as PendingRecognition[];

      setRecognitions(recognitionsData);
      setTotalCount(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));

    } catch (err) {
      console.error('Failed to load recognitions:', err);
      setError('Failed to load pending recognitions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, databases]);

  // Handle single verification
  const handleSingleVerification = async (action: 'VERIFY' | 'REJECT' | 'ADJUST_WEIGHT') => {
    if (!selectedRecognition || !justification.trim()) return;

    try {
      setActionLoading(true);

      const payload: VerificationAction = {
        recognitionId: selectedRecognition.$id,
        action,
        justification: justification.trim(),
        verifiedBy: currentUser.$id
      };

      if (action === 'ADJUST_WEIGHT' && newWeight !== undefined) {
        payload.newWeight = newWeight;
      }

      const response = await functions.createExecution(
        'verify-recognition',
        JSON.stringify(payload)
      );

      const result = JSON.parse(response.responseBody);

      if (result.success) {
        // Update local state
        setRecognitions(prev => 
          prev.map(r => 
            r.$id === selectedRecognition.$id 
              ? { ...r, status: action === 'VERIFY' ? 'VERIFIED' : 'REJECTED', weight: newWeight || r.weight }
              : r
          )
        );

        // Reset modal state
        setShowSingleModal(false);
        setSelectedRecognition(null);
        setJustification('');
        setNewWeight(undefined);

        // Show success feedback
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `Recognition ${action.toLowerCase()}ed successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);

      } else {
        setError(result.error || 'Failed to process verification');
      }

    } catch (err) {
      console.error('Verification failed:', err);
      setError('Failed to process verification. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle bulk verification
  const handleBulkVerification = async () => {
    if (selectedRecognitions.size === 0 || !justification.trim()) return;

    try {
      setActionLoading(true);

      const payload: BulkAction = {
        recognitionIds: Array.from(selectedRecognitions),
        action: bulkAction,
        justification: justification.trim()
      };

      const response = await functions.createExecution(
        'bulk-verify-recognitions',
        JSON.stringify(payload)
      );

      const result = JSON.parse(response.responseBody);

      if (result.success) {
        // Update local state
        setRecognitions(prev => 
          prev.map(r => 
            selectedRecognitions.has(r.$id)
              ? { ...r, status: bulkAction === 'VERIFY' ? 'VERIFIED' : 'REJECTED' }
              : r
          )
        );

        // Reset selection and modal
        setSelectedRecognitions(new Set());
        setShowBulkModal(false);
        setJustification('');

        // Show success feedback
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `${selectedRecognitions.size} recognitions ${bulkAction.toLowerCase()}ed successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);

      } else {
        setError(result.error || 'Failed to process bulk verification');
      }

    } catch (err) {
      console.error('Bulk verification failed:', err);
      setError('Failed to process bulk verification. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle selection
  const toggleSelection = (recognitionId: string) => {
    setSelectedRecognitions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recognitionId)) {
        newSet.delete(recognitionId);
      } else {
        newSet.add(recognitionId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedRecognitions.size === recognitions.length) {
      setSelectedRecognitions(new Set());
    } else {
      setSelectedRecognitions(new Set(recognitions.map(r => r.$id)));
    }
  };

  useEffect(() => {
    loadRecognitions();
  }, [loadRecognitions]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Recognition Verification</h1>
                <p className="mt-2 text-slate-600">
                  Review and verify pending recognitions with audit compliance
                </p>
              </div>
              {selectedRecognitions.size > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <span className="mr-2">📋</span>
                  Bulk Actions ({selectedRecognitions.size})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <span className="text-red-400 text-xl mr-3">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </select>
            </div>

            <div>
              <label htmlFor="timeRange" className="block text-sm font-medium text-slate-700 mb-1">
                Time Range
              </label>
              <select
                id="timeRange"
                value={filters.timeRange}
                onChange={(e) => setFilters(f => ({ ...f, timeRange: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div>
              <label htmlFor="hasFlags" className="block text-sm font-medium text-slate-700 mb-1">
                Flags
              </label>
              <select
                id="hasFlags"
                value={filters.hasFlags}
                onChange={(e) => setFilters(f => ({ ...f, hasFlags: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All</option>
                <option value="WITH_FLAGS">With flags</option>
                <option value="NO_FLAGS">No flags</option>
              </select>
            </div>

            <div className="flex items-end">
              <span className="text-sm text-slate-600">
                {totalCount} total • Page {currentPage} of {totalPages}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Pending Recognitions ({recognitions.length})
              </h2>
              
              {recognitions.length > 0 && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRecognitions.size === recognitions.length && recognitions.length > 0}
                    onChange={selectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                    aria-label="Select all recognitions"
                  />
                  <label className="text-sm text-slate-600">Select all</label>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading recognitions...</p>
              </div>
            </div>
          ) : recognitions.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-slate-400 text-4xl mb-4 block">✅</span>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No recognitions found</h3>
              <p className="text-slate-600">
                All recognitions have been reviewed or no items match your filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recognition
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Evidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recognitions.map((recognition) => (
                    <tr key={recognition.$id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRecognitions.has(recognition.$id)}
                          onChange={() => toggleSelection(recognition.$id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          aria-label={`Select recognition from ${recognition.giverName} to ${recognition.recipientName}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="text-sm font-medium text-slate-900 mb-1">
                            {recognition.giverName} → {recognition.recipientName}
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                            {recognition.reason}
                          </p>
                          {recognition.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {recognition.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(recognition.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">{recognition.weight}x</div>
                          {recognition.weight !== recognition.originalWeight && (
                            <div className="text-xs text-slate-500">
                              (was {recognition.originalWeight}x)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm text-slate-600 mr-1">📎</span>
                          <span className="text-sm text-slate-600">
                            {recognition.evidenceIds.length} files
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            recognition.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                            recognition.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {recognition.status.toLowerCase()}
                          </span>
                          {recognition.flagCount > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {recognition.flagCount} flags
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedRecognition(recognition);
                            setShowSingleModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single Verification Modal */}
      {showSingleModal && selectedRecognition && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">
                Review Recognition
              </h3>

              {/* Recognition details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-slate-900 mb-2">
                  {selectedRecognition.giverName} → {selectedRecognition.recipientName}
                </div>
                <p className="text-sm text-slate-600 mb-2">{selectedRecognition.reason}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Weight: {selectedRecognition.weight}x</span>
                  <span>Evidence: {selectedRecognition.evidenceIds.length} files</span>
                  <span>{new Date(selectedRecognition.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Justification */}
              <div className="mb-6">
                <label htmlFor="justification" className="block text-sm font-medium text-slate-700 mb-2">
                  Verification Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="justification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Provide justification for this verification decision..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              {/* Weight adjustment */}
              <div className="mb-6">
                <label htmlFor="newWeight" className="block text-sm font-medium text-slate-700 mb-2">
                  Adjust Weight (optional)
                </label>
                <input
                  type="number"
                  id="newWeight"
                  value={newWeight || ''}
                  onChange={(e) => setNewWeight(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  max="10"
                  className="w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={selectedRecognition.weight.toString()}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Current weight: {selectedRecognition.weight}x
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSingleModal(false);
                    setSelectedRecognition(null);
                    setJustification('');
                    setNewWeight(undefined);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSingleVerification('REJECT')}
                  disabled={actionLoading || !justification.trim()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                {newWeight && newWeight !== selectedRecognition.weight && (
                  <button
                    onClick={() => handleSingleVerification('ADJUST_WEIGHT')}
                    disabled={actionLoading || !justification.trim()}
                    className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Adjust Weight
                  </button>
                )}
                <button
                  onClick={() => handleSingleVerification('VERIFY')}
                  disabled={actionLoading || !justification.trim()}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Verification Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">
                Bulk Actions ({selectedRecognitions.size} items)
              </h3>

              {/* Action selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Action
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="VERIFY"
                      checked={bulkAction === 'VERIFY'}
                      onChange={(e) => setBulkAction(e.target.value as 'VERIFY' | 'REJECT')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-slate-700">Verify all selected</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="REJECT"
                      checked={bulkAction === 'REJECT'}
                      onChange={(e) => setBulkAction(e.target.value as 'VERIFY' | 'REJECT')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-slate-700">Reject all selected</span>
                  </label>
                </div>
              </div>

              {/* Justification */}
              <div className="mb-6">
                <label htmlFor="bulkJustification" className="block text-sm font-medium text-slate-700 mb-2">
                  Bulk Action Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bulkJustification"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Provide justification for this bulk action..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              {/* Warning */}
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex">
                  <span className="text-yellow-400 text-lg mr-2">⚠️</span>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Two-step confirmation required</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This action will {bulkAction.toLowerCase()} {selectedRecognitions.size} recognitions and cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setJustification('');
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkVerification}
                  disabled={actionLoading || !justification.trim()}
                  className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${
                    bulkAction === 'VERIFY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : `${bulkAction === 'VERIFY' ? 'Verify' : 'Reject'} ${selectedRecognitions.size} Items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}