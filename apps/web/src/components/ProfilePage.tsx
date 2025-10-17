// User Profile Page with Recognition History and Export - Production Implementation
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Query } from 'appwrite';
import { getDatabase, getFunctions } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface UserProfile {
  $id: string;
  name: string;
  email: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  department?: string;
  managerId?: string;
  joinedAt: string;
  stats: {
    recognitionsGiven: number;
    recognitionsReceived: number;
    totalWeight: number;
    verifiedRecognitions: number;
  };
}

interface ProfileRecognition {
  $id: string;
  type: 'GIVEN' | 'RECEIVED';
  otherPartyEmail: string;
  otherPartyName?: string;
  tags: string[];
  reason: string;
  weight: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  evidenceCount: number;
}

export function ProfilePage(): React.ReactElement {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, isAdmin, isManager } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recognitions, setRecognitions] = useState<ProfileRecognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'given' | 'received' | 'all'>('all');

  const databases = getDatabase();
  const functions = getFunctions();

  // Check if current user can view this profile
  const canViewProfile = () => {
    if (!currentUser || !userId) return false;
    
    // Users can view their own profile
    if (currentUser.$id === userId) return true;
    
    // Admins can view all profiles
    if (isAdmin()) return true;
    
    // Managers can view profiles in their team (implementation would need team lookup)
    if (isManager()) return true;
    
    return false;
  };

  // Load user profile and recognition statistics
  const loadProfile = async () => {
    try {
      if (!userId || !canViewProfile()) {
        setError('Access denied');
        setLoading(false);
        return;
      }

      // Get user profile (this would typically come from a users collection or Appwrite Users API)
      const userResponse = await databases.listDocuments(
        'main',
        'user_profiles',
        [Query.equal('userId', userId)]
      );

      if (userResponse.documents.length === 0) {
        setError('User profile not found');
        setLoading(false);
        return;
      }

      const userDoc = userResponse.documents[0] as any;

      // Get recognition statistics
      const [givenResponse, receivedResponse] = await Promise.all([
        databases.listDocuments(
          'main',
          'recognitions',
          [Query.equal('giverUserId', userId)]
        ),
        databases.listDocuments(
          'main',
          'recognitions',
          [Query.equal('recipientUserId', userId)]
        )
      ]);

      const givenRecognitions = givenResponse.documents as any[];
      const receivedRecognitions = receivedResponse.documents as any[];

      // Calculate stats
      const totalWeight = receivedRecognitions.reduce((sum, rec) => sum + (rec.weight || 1), 0);
      const verifiedRecognitions = receivedRecognitions.filter(rec => rec.status === 'VERIFIED').length;

      const profileData: UserProfile = {
        $id: userId,
        name: userDoc.name || 'Unknown User',
        email: userDoc.email,
        role: userDoc.role || 'USER',
        department: userDoc.department,
        managerId: userDoc.managerId,
        joinedAt: userDoc.createdAt || new Date().toISOString(),
        stats: {
          recognitionsGiven: givenRecognitions.length,
          recognitionsReceived: receivedRecognitions.length,
          totalWeight: Math.round(totalWeight * 100) / 100,
          verifiedRecognitions
        }
      };

      setProfile(profileData);

      // Combine and format recognitions for display
      const formattedRecognitions: ProfileRecognition[] = [
        ...givenRecognitions.map(rec => ({
          $id: rec.$id,
          type: 'GIVEN' as const,
          otherPartyEmail: rec.recipientEmail,
          otherPartyName: rec.recipientName,
          tags: rec.tags || [],
          reason: rec.reason,
          weight: rec.weight || 1,
          status: rec.status,
          createdAt: rec.createdAt,
          evidenceCount: rec.evidenceIds?.length || 0
        })),
        ...receivedRecognitions.map(rec => ({
          $id: rec.$id,
          type: 'RECEIVED' as const,
          otherPartyEmail: rec.giverEmail,
          otherPartyName: rec.giverName,
          tags: rec.tags || [],
          reason: rec.reason,
          weight: rec.weight || 1,
          status: rec.status,
          createdAt: rec.createdAt,
          evidenceCount: rec.evidenceIds?.length || 0
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRecognitions(formattedRecognitions);
      setError(null);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Export profile data
  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      setExportLoading(true);

      const exportResponse = await functions.createExecution(
        'export-profile',
        JSON.stringify({
          userId,
          format,
          includePrivateData: currentUser?.$id === userId || isAdmin(),
          requestedBy: currentUser?.$id
        })
      );

      const exportData = JSON.parse(exportResponse.responseBody || '{}');
      
      if (exportData.success && exportData.downloadUrl) {
        // Create temporary download link
        const link = document.createElement('a');
        link.href = exportData.downloadUrl;
        link.download = 'recognition-profile-' + profile?.name + '-' + format + '.' + format;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Announce success
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = 'Profile exported successfully as ' + format.toUpperCase();
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
      } else {
        throw new Error(exportData.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed:', err);
      
      // Announce error
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Profile export failed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
    } finally {
      setExportLoading(false);
    }
  };

  // Filter recognitions based on view mode
  const filteredRecognitions = recognitions.filter(rec => {
    if (viewMode === 'given') return rec.type === 'GIVEN';
    if (viewMode === 'received') return rec.type === 'RECEIVED';
    return true;
  });

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 1) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 30) return diffInDays + ' days ago';
    if (diffInDays < 365) return Math.floor(diffInDays / 30) + ' months ago';
    return Math.floor(diffInDays / 365) + ' years ago';
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  if (!canViewProfile()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-red-700">You don't have permission to view this profile.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-red-700">{error || 'Profile not found'}</p>
          <button
            onClick={loadProfile}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{profile.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>{profile.email}</span>
              <span>•</span>
              <span className="capitalize font-medium">{profile.role.toLowerCase()}</span>
              {profile.department && (
                <>
                  <span>•</span>
                  <span>{profile.department}</span>
                </>
              )}
              <span>•</span>
              <span>Joined {formatRelativeTime(profile.joinedAt)}</span>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exportLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Given</h3>
          <p className="text-3xl font-bold text-blue-600">{profile.stats.recognitionsGiven}</p>
          <p className="text-sm text-gray-500">Recognitions given</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Received</h3>
          <p className="text-3xl font-bold text-green-600">{profile.stats.recognitionsReceived}</p>
          <p className="text-sm text-gray-500">Recognitions received</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Total Weight</h3>
          <p className="text-3xl font-bold text-orange-600">{profile.stats.totalWeight}</p>
          <p className="text-sm text-gray-500">Recognition impact score</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Verified</h3>
          <p className="text-3xl font-bold text-purple-600">{profile.stats.verifiedRecognitions}</p>
          <p className="text-sm text-gray-500">Manager-verified</p>
        </div>
      </div>

      {/* Recognition History */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
              Recognition History
            </h2>

            {/* View Mode Tabs */}
            <div className="flex bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({recognitions.length})
              </button>
              <button
                onClick={() => setViewMode('received')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  viewMode === 'received'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Received ({recognitions.filter(r => r.type === 'RECEIVED').length})
              </button>
              <button
                onClick={() => setViewMode('given')}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  viewMode === 'given'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Given ({recognitions.filter(r => r.type === 'GIVEN').length})
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredRecognitions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recognitions found for the selected view.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRecognitions.map((recognition) => (
                <div key={recognition.$id} className="border-l-4 border-blue-200 pl-4 py-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          recognition.type === 'RECEIVED' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {recognition.type}
                        </span>
                        <span className="text-sm text-gray-600">
                          {recognition.type === 'RECEIVED' ? 'from' : 'to'} {recognition.otherPartyEmail}
                        </span>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-500">
                          {formatRelativeTime(recognition.createdAt)}
                        </span>
                        {recognition.weight > 1 && (
                          <>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-orange-600 font-medium">
                              {recognition.weight}x weight
                            </span>
                          </>
                        )}
                      </div>

                      {/* Tags */}
                      {recognition.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {recognition.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Recognition Text */}
                      <p className="text-gray-800 mb-2">{recognition.reason}</p>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className={`px-2 py-1 rounded ${
                          recognition.status === 'VERIFIED' ? 'bg-green-50 text-green-600' :
                          recognition.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {recognition.status}
                        </span>
                        {recognition.evidenceCount > 0 && (
                          <span>📎 {recognition.evidenceCount} evidence file(s)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}