// HR Export System - PDF/CSV Exports for Performance Reviews
import React, { useState } from 'react';
import { getFunctions } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface ExportRequest {
  type: 'INDIVIDUAL' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION';
  format: 'PDF' | 'CSV';
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    includePrivate: boolean;
    includePending: boolean;
    includeVerified: boolean;
    anonymizeData: boolean;
    weightThreshold?: number;
    tags?: string[];
  };
  targets?: {
    userIds?: string[];
    departments?: string[];
    managers?: string[];
  };
}

interface ExportHistory {
  $id: string;
  type: string;
  format: string;
  requestedBy: string;
  requestedAt: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  expiresAt?: string;
  recordCount?: number;
  error?: string;
}

export function HRExportSystem(): React.ReactElement {
  const { currentUser, isAdmin, isManager } = useAuth();
  const [exportRequest, setExportRequest] = useState<ExportRequest>({
    type: 'INDIVIDUAL',
    format: 'PDF',
    dateRange: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
      end: new Date().toISOString().split('T')[0]
    },
    filters: {
      includePrivate: false,
      includePending: false,
      includeVerified: true,
      anonymizeData: false
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string>('');
  const [selectedDepartments, setSelectedDepartments] = useState<string>('');

  const functions = getFunctions();

  // Handle export request
  const handleExport = async () => {
    try {
      if (!currentUser) {
        setError('Authentication required');
        return;
      }

      // Validate permissions
      if (!isAdmin() && !isManager()) {
        setError('Manager or Admin permissions required');
        return;
      }

      // Validate date range
      const startDate = new Date(exportRequest.dateRange.start);
      const endDate = new Date(exportRequest.dateRange.end);
      
      if (startDate >= endDate) {
        setError('End date must be after start date');
        return;
      }

      const maxRangeMonths = isAdmin() ? 24 : 12; // Admins can export up to 2 years
      const monthsDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      if (monthsDiff > maxRangeMonths) {
        setError(`Date range cannot exceed ${maxRangeMonths} months`);
        return;
      }

      // Validate targets for individual/team exports
      if (exportRequest.type === 'INDIVIDUAL' && !selectedUsers.trim()) {
        setError('Please specify user email addresses');
        return;
      }

      if (exportRequest.type === 'TEAM' && !selectedUsers.trim() && !selectedDepartments.trim()) {
        setError('Please specify users or departments');
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      // Prepare export data
      const exportData = {
        ...exportRequest,
        targets: {
          userIds: selectedUsers.trim() ? selectedUsers.split(',').map(email => email.trim()) : undefined,
          departments: selectedDepartments.trim() ? selectedDepartments.split(',').map(dept => dept.trim()) : undefined
        },
        requestedBy: currentUser.$id,
        requestedAt: new Date().toISOString(),
        permissions: {
          isAdmin: isAdmin(),
          isManager: isManager()
        }
      };

      const response = await functions.createExecution(
        'hr-export-system',
        JSON.stringify(exportData)
      );

      const result = JSON.parse(response.responseBody || '{}');

      if (result.success) {
        if (result.downloadUrl) {
          // Direct download
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.download = result.filename || 'recognition-export.' + exportRequest.format.toLowerCase();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setSuccess('Export completed successfully');
        } else if (result.exportId) {
          // Async processing
          setSuccess('Export request submitted. You will receive a notification when ready.');
          
          // Add to history
          const newExport: ExportHistory = {
            $id: result.exportId,
            type: exportRequest.type,
            format: exportRequest.format,
            requestedBy: currentUser.$id,
            requestedAt: new Date().toISOString(),
            status: 'PROCESSING'
          };
          
          setExportHistory(prev => [newExport, ...prev]);
        }

        // Reset form on success
        setSelectedUsers('');
        setSelectedDepartments('');
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed:', err);
      setError('Export failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Load export history
  const loadExportHistory = async () => {
    try {
      const response = await functions.createExecution(
        'hr-export-history',
        JSON.stringify({ requestedBy: currentUser?.$id })
      );

      const result = JSON.parse(response.responseBody || '{}');
      
      if (result.success && result.exports) {
        setExportHistory(result.exports);
      }
    } catch (err) {
      console.error('Failed to load export history:', err);
    }
  };

  // Format file size
  // Helper function for file size formatting (for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return diffInMinutes + ' minutes ago';
    if (diffInMinutes < 1440) return Math.floor(diffInMinutes / 60) + ' hours ago';
    return Math.floor(diffInMinutes / 1440) + ' days ago';
  };

  React.useEffect(() => {
    if (currentUser) {
      loadExportHistory();
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Authentication Required</h1>
          <p className="text-red-700">Please log in to access the HR export system.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin() && !isManager()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-red-700">Manager or Admin permissions required to access HR exports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HR Export System</h1>
        <p className="text-gray-600">
          Generate PDF and CSV exports for performance reviews and HR reporting
        </p>
      </div>

      {/* Export Form */}
      <div className="bg-white rounded-lg shadow-sm border mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Export</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Type and Format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="export-type" className="block text-sm font-medium text-gray-700 mb-2">
                Export Type
              </label>
              <select
                id="export-type"
                value={exportRequest.type}
                onChange={(e) => setExportRequest(prev => ({ 
                  ...prev, 
                  type: e.target.value as ExportRequest['type'] 
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Select export type"
              >
                <option value="INDIVIDUAL">Individual User Report</option>
                <option value="TEAM">Team Report</option>
                <option value="DEPARTMENT">Department Report</option>
                {isAdmin() && <option value="ORGANIZATION">Organization Report</option>}
              </select>
            </div>

            <div>
              <label htmlFor="export-format" className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                id="export-format"
                value={exportRequest.format}
                onChange={(e) => setExportRequest(prev => ({ 
                  ...prev, 
                  format: e.target.value as ExportRequest['format'] 
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Select export format"
              >
                <option value="PDF">PDF Report</option>
                <option value="CSV">CSV Data</option>
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-xs text-gray-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={exportRequest.dateRange.start}
                  onChange={(e) => setExportRequest(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-xs text-gray-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={exportRequest.dateRange.end}
                  onChange={(e) => setExportRequest(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value }
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Target Selection */}
          {(exportRequest.type === 'INDIVIDUAL' || exportRequest.type === 'TEAM') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Users
              </label>
              <textarea
                value={selectedUsers}
                onChange={(e) => setSelectedUsers(e.target.value)}
                placeholder="Enter email addresses separated by commas (e.g., john@example.com, jane@example.com)"
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {exportRequest.type === 'TEAM' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departments (Optional)
              </label>
              <input
                type="text"
                value={selectedDepartments}
                onChange={(e) => setSelectedDepartments(e.target.value)}
                placeholder="Enter department names separated by commas"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Filter Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Options
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportRequest.filters.includeVerified}
                    onChange={(e) => setExportRequest(prev => ({
                      ...prev,
                      filters: { ...prev.filters, includeVerified: e.target.checked }
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include verified recognitions</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportRequest.filters.includePending}
                    onChange={(e) => setExportRequest(prev => ({
                      ...prev,
                      filters: { ...prev.filters, includePending: e.target.checked }
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include pending recognitions</span>
                </label>

                {isAdmin() && (
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportRequest.filters.includePrivate}
                      onChange={(e) => setExportRequest(prev => ({
                        ...prev,
                        filters: { ...prev.filters, includePrivate: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include private recognitions (Admin only)</span>
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportRequest.filters.anonymizeData}
                    onChange={(e) => setExportRequest(prev => ({
                      ...prev,
                      filters: { ...prev.filters, anonymizeData: e.target.checked }
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Anonymize personal data</span>
                </label>

                <div className="flex items-center gap-2">
                  <label htmlFor="weight-threshold" className="text-sm text-gray-700">
                    Min weight:
                  </label>
                  <input
                    type="number"
                    id="weight-threshold"
                    value={exportRequest.filters.weightThreshold || ''}
                    onChange={(e) => setExportRequest(prev => ({
                      ...prev,
                      filters: { ...prev.filters, weightThreshold: e.target.value ? parseFloat(e.target.value) : undefined }
                    }))}
                    min="1"
                    max="10"
                    step="0.1"
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Export Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Export Successful</h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                </div>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export History */}
      {exportHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Export History</h2>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {exportHistory.map((exportRecord) => (
                <div key={exportRecord.$id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">
                          {exportRecord.type} {exportRecord.format}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          exportRecord.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          exportRecord.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {exportRecord.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Requested {formatRelativeTime(exportRecord.requestedAt)}
                        {exportRecord.recordCount && (
                          <span> • {exportRecord.recordCount} records</span>
                        )}
                      </div>
                      {exportRecord.error && (
                        <div className="text-sm text-red-600 mt-1">{exportRecord.error}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {exportRecord.status === 'COMPLETED' && exportRecord.downloadUrl && (
                        <a
                          href={exportRecord.downloadUrl}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Download
                        </a>
                      )}
                      {exportRecord.expiresAt && (
                        <span className="text-xs text-gray-500">
                          Expires {formatRelativeTime(exportRecord.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}