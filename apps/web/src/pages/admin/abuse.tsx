// Admin Abuse Review Dashboard - Production Implementation
import React, { useState, useEffect, useCallback } from 'react';
import { functions, databases } from '../../appwrite/client';
import { ID } from 'appwrite';

// Type definitions (inline until schema package is properly imported)
interface AbuseFlag {
  $id: string;
  recognitionId: string;
  flagType: 'RECIPROCITY' | 'FREQUENCY' | 'CONTENT' | 'EVIDENCE' | 'WEIGHT_MANIPULATION' | 'MANUAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectionMethod: 'AUTOMATIC' | 'REPORTED' | 'MANUAL_REVIEW';
  flaggedBy: 'SYSTEM' | 'USER' | 'ADMIN';
  flaggedAt: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  metadata: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

interface AdminOverride {
  flagId: string;
  action: 'DISMISS' | 'APPROVE' | 'ADJUST_WEIGHT' | 'ESCALATE';
  justification: string;
  newWeight?: number;
  escalationReason?: string;
}

// Interfaces for admin dashboard
interface RecognitionDetails {
  $id: string;
  giverEmail: string;
  giverName: string;
  recipientEmail: string;
  recipientName: string;
  reason: string;
  tags: string[];
  weight: number;
  originalWeight: number;
  evidenceIds: string[];
  createdAt: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface AbuseCase {
  flags: AbuseFlag[];
  recognition: RecognitionDetails;
  suggestedAction: 'DISMISS' | 'APPROVE' | 'ADJUST_WEIGHT' | 'ESCALATE';
  riskScore: number;
}

interface AdminStats {
  totalFlags: number;
  pendingReview: number;
  resolvedToday: number;
  criticalFlags: number;
  flagsByType: Record<string, number>;
}

const DATABASE_ID = process.env.REACT_APP_DATABASE_ID || 'main';
const ABUSE_FLAGS_COLLECTION_ID = 'abuse_flags';
const RECOGNITIONS_COLLECTION_ID = 'recognitions';

export default function AbuseAdminPage(): React.ReactElement {
  // Mock auth and i18n until proper hooks are available
  const user = { id: 'admin', role: 'ADMIN' };
  const isAdmin = true;
  const t = (key: string, fallback?: string) => fallback || key;
  
  // State management
  const [abuseCases, setAbuseCases] = useState<AbuseCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<AbuseCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [filters, setFilters] = useState({
    status: 'PENDING',
    severity: 'ALL',
    flagType: 'ALL',
    dateRange: '7d'
  });
  const [justification, setJustification] = useState('');
  const [newWeight, setNewWeight] = useState<number | undefined>();

  // Check admin permissions
  useEffect(() => {
    if (!user || !isAdmin) {
      setError('Admin access required');
      return;
    }
    loadAbuseData();
    loadAdminStats();
  }, [user, isAdmin, filters]);

  // Load abuse cases with current filters
  const loadAbuseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query filters
      const queryFilters = [];
      if (filters.status !== 'ALL') {
        queryFilters.push(`status.equal("${filters.status}")`);
      }
      if (filters.severity !== 'ALL') {
        queryFilters.push(`severity.equal("${filters.severity}")`);
      }
      if (filters.flagType !== 'ALL') {
        queryFilters.push(`flagType.equal("${filters.flagType}")`);
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange.replace('d', ''));
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        queryFilters.push(`flaggedAt.greaterThanEqual("${startDate}")`);
      }

      // Fetch abuse flags
      const flagsResponse = await databases.listDocuments(
        DATABASE_ID,
        ABUSE_FLAGS_COLLECTION_ID,
        queryFilters.concat(['$orderDesc("flaggedAt")'])
      );

      // Group flags by recognition ID and fetch recognition details
      const recognitionGroups = new Map<string, AbuseFlag[]>();
      
      for (const flag of flagsResponse.documents) {
        const recognitionId = flag.recognitionId;
        if (!recognitionGroups.has(recognitionId)) {
          recognitionGroups.set(recognitionId, []);
        }
        // Convert Document to AbuseFlag with proper typing
        const abuseFlag: AbuseFlag = {
          $id: flag.$id,
          recognitionId: flag.recognitionId,
          flagType: flag.flagType,
          severity: flag.severity,
          description: flag.description,
          detectionMethod: flag.detectionMethod,
          flaggedBy: flag.flaggedBy,
          flaggedAt: flag.flaggedAt,
          status: flag.status,
          reviewedBy: flag.reviewedBy,
          reviewedAt: flag.reviewedAt,
          reviewNotes: flag.reviewNotes,
          metadata: flag.metadata,
          createdAt: flag.createdAt,
          updatedAt: flag.updatedAt,
        };
        recognitionGroups.get(recognitionId)!.push(abuseFlag);
      }

      // Fetch recognition details for each group
      const cases: AbuseCase[] = [];
      
      for (const [recognitionId, flags] of recognitionGroups) {
        try {
          const recognitionResponse = await databases.getDocument(
            DATABASE_ID,
            RECOGNITIONS_COLLECTION_ID,
            recognitionId
          );

          const recognition: RecognitionDetails = {
            $id: recognitionResponse.$id,
            giverEmail: recognitionResponse.giverEmail,
            giverName: recognitionResponse.giverName,
            recipientEmail: recognitionResponse.recipientEmail,
            recipientName: recognitionResponse.recipientName || recognitionResponse.recipientEmail,
            reason: recognitionResponse.reason,
            tags: recognitionResponse.tags || [],
            weight: recognitionResponse.weight || 1,
            originalWeight: recognitionResponse.originalWeight || recognitionResponse.weight || 1,
            evidenceIds: recognitionResponse.evidenceIds || [],
            createdAt: recognitionResponse.createdAt,
            status: recognitionResponse.status || 'PENDING'
          };

          const riskScore = calculateRiskScore(flags);
          const suggestedAction = determineSuggestedAction(flags, recognition);

          cases.push({
            flags,
            recognition,
            suggestedAction,
            riskScore
          });
        } catch (err) {
          console.warn(`Could not fetch recognition ${recognitionId}:`, err);
          // Skip cases where recognition was deleted
        }
      }

      // Sort by risk score descending
      cases.sort((a, b) => b.riskScore - a.riskScore);
      setAbuseCases(cases);

    } catch (err) {
      console.error('Failed to load abuse data:', err);
      setError('Failed to load abuse cases. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load admin statistics
  const loadAdminStats = async () => {
    try {
      const response = await functions.createExecution(
        'admin-abuse-report',
        JSON.stringify({ summaryOnly: true })
      );
      
      const result = JSON.parse(response.responseBody);
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  };

  // Calculate risk score for prioritization
  const calculateRiskScore = (flags: AbuseFlag[]): number => {
    let score = 0;
    const severityWeights: Record<string, number> = { 'LOW': 1, 'MEDIUM': 3, 'HIGH': 7, 'CRITICAL': 15 };
    
    for (const flag of flags) {
      score += severityWeights[flag.severity] || 0;
    }
    
    return score;
  };

  // Determine suggested admin action
  const determineSuggestedAction = (flags: AbuseFlag[], recognition: RecognitionDetails): 'DISMISS' | 'APPROVE' | 'ADJUST_WEIGHT' | 'ESCALATE' => {
    const hasHighSeverity = flags.some(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');
    const hasWeightIssues = flags.some(f => f.flagType === 'WEIGHT_MANIPULATION');
    const hasContentIssues = flags.some(f => f.flagType === 'CONTENT');
    
    if (hasHighSeverity) return 'ESCALATE';
    if (hasWeightIssues) return 'ADJUST_WEIGHT';
    if (hasContentIssues && recognition.weight < 1.5) return 'DISMISS';
    return 'APPROVE';
  };

  // Handle admin override action
  const handleAdminAction = async (action: AdminOverride['action']) => {
    if (!selectedCase || !justification.trim()) {
      setError('Justification is required for all admin actions');
      return;
    }

    if (action === 'ADJUST_WEIGHT' && (newWeight === undefined || newWeight < 0 || newWeight > 10)) {
      setError('Valid weight (0-10) required for weight adjustment');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const payload: AdminOverride = {
        flagId: selectedCase.flags[0].$id, // Use first flag ID as primary
        action,
        justification: justification.trim(),
        newWeight: action === 'ADJUST_WEIGHT' ? newWeight : undefined
      };

      // Execute admin override via function
      const response = await functions.createExecution(
        'admin-override-abuse',
        JSON.stringify(payload)
      );

      const result = JSON.parse(response.responseBody);
      
      if (result.success) {
        // Update local state
        setAbuseCases(cases => 
          cases.filter(c => c.recognition.$id !== selectedCase.recognition.$id)
        );
        
        setSelectedCase(null);
        setJustification('');
        setNewWeight(undefined);
        
        // Refresh stats
        await loadAdminStats();
        
        // Show success message
        setError(null);
      } else {
        setError(result.error || 'Failed to execute admin action');
      }

    } catch (err) {
      console.error('Admin action failed:', err);
      setError('Failed to execute admin action. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Render severity badge
  const renderSeverityBadge = (severity: string) => {
    const colors = {
      'LOW': 'bg-gray-100 text-gray-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'CRITICAL': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[severity as keyof typeof colors]}`}>
        {severity}
      </span>
    );
  };

  // Render flag type badge
  const renderFlagBadge = (flagType: string) => {
    const colors = {
      'RECIPROCITY': 'bg-purple-100 text-purple-800',
      'FREQUENCY': 'bg-blue-100 text-blue-800',
      'CONTENT': 'bg-green-100 text-green-800',
      'EVIDENCE': 'bg-indigo-100 text-indigo-800',
      'WEIGHT_MANIPULATION': 'bg-red-100 text-red-800',
      'MANUAL': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[flagType as keyof typeof colors]}`}>
        {flagType}
      </span>
    );
  };

  // Handle access control
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">🚫</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('admin.access_denied', 'Access Denied')}
            </h2>
            <p className="text-gray-600">
              {t('admin.admin_required', 'Administrator access is required to view this page.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('admin.abuse_dashboard', 'Abuse Review Dashboard')}
            </h1>
            <p className="mt-2 text-gray-600">
              {t('admin.abuse_subtitle', 'Review and manage flagged recognitions requiring administrative action')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Flags</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalFlags}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 text-xl">⏳</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingReview}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Resolved Today</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.resolvedToday}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-xl">🚨</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Critical Flags</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.criticalFlags}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="ALL">All</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                id="severity"
                value={filters.severity}
                onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All Severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="flagType" className="block text-sm font-medium text-gray-700 mb-1">
                Flag Type
              </label>
              <select
                id="flagType"
                value={filters.flagType}
                onChange={(e) => setFilters(f => ({ ...f, flagType: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="RECIPROCITY">Reciprocity</option>
                <option value="FREQUENCY">Frequency</option>
                <option value="CONTENT">Content</option>
                <option value="EVIDENCE">Evidence</option>
                <option value="WEIGHT_MANIPULATION">Weight Manipulation</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                id="dateRange"
                value={filters.dateRange}
                onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Abuse Cases List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Flagged Cases ({abuseCases.length})
                </h2>
              </div>
              
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">Loading abuse cases...</p>
                </div>
              ) : abuseCases.length === 0 ? (
                <div className="p-12 text-center">
                  <span className="text-gray-400 text-4xl">✨</span>
                  <p className="mt-2 text-gray-500">No abuse cases found with current filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {abuseCases.map((abuseCase, index) => (
                    <div
                      key={`${abuseCase.recognition.$id}-${index}`}
                      className={`p-6 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedCase?.recognition.$id === abuseCase.recognition.$id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedCase(abuseCase)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              {abuseCase.recognition.giverName} → {abuseCase.recognition.recipientName}
                            </span>
                            <span className="text-xs text-gray-500">
                              Risk: {abuseCase.riskScore}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {abuseCase.recognition.reason}
                          </p>
                          
                          <div className="flex flex-wrap gap-2 mb-2">
                            {abuseCase.flags.map((flag, flagIndex) => (
                              <div key={flagIndex} className="flex items-center space-x-1">
                                {renderFlagBadge(flag.flagType)}
                                {renderSeverityBadge(flag.severity)}
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            Weight: {abuseCase.recognition.weight} | 
                            Evidence: {abuseCase.recognition.evidenceIds.length} | 
                            {new Date(abuseCase.flags[0].flaggedAt).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            abuseCase.suggestedAction === 'ESCALATE' ? 'bg-red-100 text-red-800' :
                            abuseCase.suggestedAction === 'ADJUST_WEIGHT' ? 'bg-yellow-100 text-yellow-800' :
                            abuseCase.suggestedAction === 'APPROVE' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {abuseCase.suggestedAction}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Case Details and Actions */}
          <div className="lg:col-span-1">
            {selectedCase ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Case Details</h3>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Recognition Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Recognition</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <p className="text-sm"><strong>From:</strong> {selectedCase.recognition.giverName}</p>
                      <p className="text-sm"><strong>To:</strong> {selectedCase.recognition.recipientName}</p>
                      <p className="text-sm"><strong>Weight:</strong> {selectedCase.recognition.weight}</p>
                      <p className="text-sm"><strong>Evidence:</strong> {selectedCase.recognition.evidenceIds.length} files</p>
                      <p className="text-sm"><strong>Tags:</strong> {selectedCase.recognition.tags.join(', ') || 'None'}</p>
                      <p className="text-sm"><strong>Reason:</strong></p>
                      <p className="text-sm text-gray-600 bg-white p-2 rounded border">{selectedCase.recognition.reason}</p>
                    </div>
                  </div>
                  
                  {/* Flags Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Flags ({selectedCase.flags.length})</h4>
                    <div className="space-y-3">
                      {selectedCase.flags.map((flag, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            {renderFlagBadge(flag.flagType)}
                            {renderSeverityBadge(flag.severity)}
                          </div>
                          <p className="text-sm text-gray-600">{flag.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(flag.flaggedAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Suggested Action */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Suggested Action</h4>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900">{selectedCase.suggestedAction}</p>
                      <p className="text-xs text-blue-600 mt-1">Risk Score: {selectedCase.riskScore}</p>
                    </div>
                  </div>
                  
                  {/* Admin Actions */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Admin Actions</h4>
                    
                    {/* Justification */}
                    <div className="mb-4">
                      <label htmlFor="justification" className="block text-sm font-medium text-gray-700 mb-1">
                        Justification <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="justification"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Provide justification for this admin action..."
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        rows={3}
                        required
                      />
                    </div>
                    
                    {/* Weight Adjustment */}
                    <div className="mb-4">
                      <label htmlFor="newWeight" className="block text-sm font-medium text-gray-700 mb-1">
                        New Weight (for weight adjustment)
                      </label>
                      <input
                        type="number"
                        id="newWeight"
                        value={newWeight || ''}
                        onChange={(e) => setNewWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                        min="0"
                        max="10"
                        step="0.1"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.0 - 10.0"
                      />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAdminAction('DISMISS')}
                        disabled={actionLoading || !justification.trim()}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Dismiss
                      </button>
                      
                      <button
                        onClick={() => handleAdminAction('APPROVE')}
                        disabled={actionLoading || !justification.trim()}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      
                      <button
                        onClick={() => handleAdminAction('ADJUST_WEIGHT')}
                        disabled={actionLoading || !justification.trim() || newWeight === undefined}
                        className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Adjust Weight
                      </button>
                      
                      <button
                        onClick={() => handleAdminAction('ESCALATE')}
                        disabled={actionLoading || !justification.trim()}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Escalate
                      </button>
                    </div>
                    
                    {actionLoading && (
                      <div className="mt-3 text-center">
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <span className="text-gray-400 text-4xl">👆</span>
                <p className="mt-2 text-gray-500">Select a case to review details and take action</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}