// User Profile Page with Recognition Export
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getDatabase, getFunctions } from '../../appwrite/client';
import { Query } from 'appwrite';

interface ProfileSummary {
  userId: string;
  name: string;
  email: string;
  department?: string;
  role: string;
  avatar?: string;
  recognitionsGiven: number;
  recognitionsReceived: number;
  totalWeight: number;
  recentRecognitions: Recognition[];
}

interface Recognition {
  $id: string;
  giverName: string;
  giverEmail: string;
  recipientEmail: string;
  tags: string[];
  reason: string;
  weight: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  createdAt: string;
}

interface ExportProgress {
  isExporting: boolean;
  type: 'pdf' | 'csv' | null;
  progress: number;
  downloadUrl?: string;
  error?: string;
}

export default function ProfilePage(): React.ReactElement {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const databases = getDatabase();
  const functions = getFunctions();
  
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    isExporting: false,
    type: null,
    progress: 0
  });
  
  const isOwnProfile = userId === currentUser?.$id;
  const canViewProfile = isOwnProfile || currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  
  useEffect(() => {
    if (!userId) {
      navigate('/feed');
      return;
    }
    
    if (!canViewProfile) {
      setError('You do not have permission to view this profile');
      setLoading(false);
      return;
    }
    
    loadProfile();
  }, [userId, currentUser]);
  
  const loadProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load user profile data and recognition statistics
      const [givenResponse, receivedResponse] = await Promise.all([
        databases.listDocuments(
          import.meta.env.VITE_APPWRITE_DATABASE_ID,
          'recognitions',
          [
            Query.equal('giverUserId', userId),
            Query.orderDesc('createdAt'),
            Query.limit(50)
          ]
        ),
        databases.listDocuments(
          import.meta.env.VITE_APPWRITE_DATABASE_ID,
          'recognitions',
          [
            Query.equal('recipientEmail', currentUser?.email || ''),
            Query.orderDesc('createdAt'),
            Query.limit(20)
          ]
        )
      ]);
      
      const givenRecognitions = givenResponse.documents as unknown as Recognition[];
      const receivedRecognitions = receivedResponse.documents as unknown as Recognition[];
      
      // Calculate metrics
      const totalWeight = receivedRecognitions
        .filter(r => r.status === 'VERIFIED')
        .reduce((sum, r) => sum + r.weight, 0);
      
      const profileSummary: ProfileSummary = {
        userId: userId,
        name: currentUser?.name || 'Unknown User',
        email: currentUser?.email || '',
        department: currentUser?.department,
        role: currentUser?.role || 'USER',
        avatar: currentUser?.avatar,
        recognitionsGiven: givenRecognitions.length,
        recognitionsReceived: receivedRecognitions.length,
        totalWeight: Math.round(totalWeight * 100) / 100,
        recentRecognitions: [...givenRecognitions, ...receivedRecognitions]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
      };
      
      setProfile(profileSummary);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExport = async (format: 'pdf' | 'csv', includePrivateData = false) => {
    if (!profile || !canViewProfile) return;
    
    setExportProgress({
      isExporting: true,
      type: format,
      progress: 0,
      error: undefined
    });
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 80)
        }));
      }, 200);
      
      const response = await functions.createExecution(
        'export-profile',
        JSON.stringify({
          userId: profile.userId,
          format,
          includePrivateData: includePrivateData && isOwnProfile,
          requesterId: currentUser?.$id
        })
      );
      
      clearInterval(progressInterval);
      
      const result = JSON.parse(response.responseBody || '{}');
      
      if (result.success) {
        setExportProgress({
          isExporting: false,
          type: null,
          progress: 100,
          downloadUrl: result.downloadUrl
        });
        
        // Trigger download
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `${profile.name}-recognition-report-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Announce to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `${format.toUpperCase()} export completed and download started`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
        
        // Clear progress after delay
        setTimeout(() => {
          setExportProgress({
            isExporting: false,
            type: null,
            progress: 0
          });
        }, 3000);
        
      } else {
        throw new Error(result.error || 'Export failed');
      }
      
    } catch (err) {
      console.error('Export failed:', err);
      setExportProgress({
        isExporting: false,
        type: null,
        progress: 0,
        error: err instanceof Error ? err.message : 'Export failed'
      });
      
      // Announce error to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.className = 'sr-only';
      announcement.textContent = 'Export failed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 2000);
    }
  };
  
  const handleShare = async () => {
    if (!profile) return;
    
    const shareData = {
      title: `${profile.name}'s Recognition Profile`,
      text: `Check out ${profile.name}'s recognition achievements: ${profile.recognitionsReceived} recognitions received with a total weight of ${profile.totalWeight}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = 'Profile link copied to clipboard';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/feed')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Feed
          </button>
        </div>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <button
            onClick={() => navigate('/feed')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Feed
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{profile.name}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>{profile.email}</span>
                    {profile.department && <span>• {profile.department}</span>}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      profile.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                      profile.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.role}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Share profile"
                  >
                    Share
                  </button>
                  
                  {canViewProfile && (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const [format, includePrivate] = e.target.value.split('-');
                          if (format) {
                            handleExport(format as 'pdf' | 'csv', includePrivate === 'private');
                          }
                        }}
                        value=""
                        disabled={exportProgress.isExporting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Export recognition data"
                      >
                        <option value="">Export</option>
                        <option value="pdf-public">PDF Report (Public Data)</option>
                        <option value="csv-public">CSV Data (Public)</option>
                        {isOwnProfile && (
                          <>
                            <option value="pdf-private">PDF Report (Include Private)</option>
                            <option value="csv-private">CSV Data (Include Private)</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Export Progress */}
          {exportProgress.isExporting && (
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-medium text-blue-700 mb-1">
                    <span>Exporting {exportProgress.type?.toUpperCase()} report...</span>
                    <span>{exportProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress.progress}%` }}
                      role="progressbar"
                      aria-label="Export progress"
                      aria-valuenow={exportProgress.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Export Error */}
          {exportProgress.error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600" role="alert">{exportProgress.error}</p>
            </div>
          )}
        </div>
        
        {/* Recognition Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-xl">👏</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recognitions Received</p>
                <p className="text-2xl font-bold text-gray-900">{profile.recognitionsReceived}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-xl">🎯</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recognition Weight</p>
                <p className="text-2xl font-bold text-gray-900">{profile.totalWeight}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 text-xl">🚀</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recognitions Given</p>
                <p className="text-2xl font-bold text-gray-900">{profile.recognitionsGiven}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Recognitions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Recognition Activity</h2>
          
          {profile.recentRecognitions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">🎉</div>
              <p className="text-gray-600">No recognition activity yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.recentRecognitions.map((recognition) => (
                <div key={recognition.$id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                        <span className="font-medium text-gray-900">
                          {recognition.giverEmail === profile.email ? 'You' : recognition.giverName}
                        </span>
                        <span>
                          {recognition.giverEmail === profile.email ? 'recognized' : 'recognized you'}
                        </span>
                        <time dateTime={recognition.createdAt}>
                          {new Date(recognition.createdAt).toLocaleDateString()}
                        </time>
                      </div>
                      <p className="text-gray-900 text-sm mb-2 line-clamp-2">{recognition.reason}</p>
                      <div className="flex flex-wrap gap-1">
                        {recognition.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className="text-sm font-medium text-gray-600">
                        Weight: {recognition.weight}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recognition.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                        recognition.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {recognition.status.toLowerCase()}
                      </span>
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