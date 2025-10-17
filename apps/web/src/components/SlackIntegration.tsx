// Slack Integration - Recognition Bot and Notification System
import React, { useState, useEffect } from 'react';
import { getDatabase, getFunctions } from '../appwrite/client';
import { useAuth } from '../lib/auth';

interface SlackIntegration {
  $id: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  channelId?: string;
  channelName?: string;
  webhookUrl?: string;
  isActive: boolean;
  installedBy: string;
  installedAt: string;
  settings: {
    notifyOnRecognition: boolean;
    notifyOnVerification: boolean;
    allowSlashCommands: boolean;
    defaultVisibility: 'PRIVATE' | 'TEAM' | 'PUBLIC';
  };
}

interface SlackNotificationLog {
  $id: string;
  type: 'RECOGNITION_CREATED' | 'RECOGNITION_VERIFIED' | 'COMMAND_USED';
  teamId: string;
  channelId?: string;
  userId?: string;
  recognitionId?: string;
  message: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export function SlackIntegration(): React.ReactElement {
  const { currentUser, isAdmin } = useAuth();
  const [integrations, setIntegrations] = useState<SlackIntegration[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<SlackNotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const databases = getDatabase();
  const functions = getFunctions();

  // Load Slack integrations
  const loadIntegrations = async () => {
    try {
      if (!currentUser || !isAdmin()) {
        setError('Admin access required');
        setLoading(false);
        return;
      }

      // Get Slack integrations
      const integrationsResponse = await databases.listDocuments(
        'main',
        'slack_integrations'
      );

      // Get recent notification logs
      const logsResponse = await databases.listDocuments(
        'main',
        'slack_notification_logs'
      );

      const integrationsData = integrationsResponse.documents.map(doc => ({
        $id: doc.$id,
        teamId: doc.teamId,
        teamName: doc.teamName,
        botUserId: doc.botUserId,
        channelId: doc.channelId,
        channelName: doc.channelName,
        webhookUrl: doc.webhookUrl,
        isActive: doc.isActive,
        installedBy: doc.installedBy,
        installedAt: doc.installedAt,
        settings: doc.settings || {
          notifyOnRecognition: true,
          notifyOnVerification: true,
          allowSlashCommands: true,
          defaultVisibility: 'TEAM'
        }
      })) as SlackIntegration[];

      const logsData = logsResponse.documents.map(doc => ({
        $id: doc.$id,
        type: doc.type,
        teamId: doc.teamId,
        channelId: doc.channelId,
        userId: doc.userId,
        recognitionId: doc.recognitionId,
        message: doc.message,
        success: doc.success,
        error: doc.error,
        timestamp: doc.timestamp
      })) as SlackNotificationLog[];

      setIntegrations(integrationsData);
      setNotificationLogs(logsData);
      setError(null);
    } catch (err) {
      console.error('Failed to load Slack integrations:', err);
      setError('Failed to load Slack integrations');
    } finally {
      setLoading(false);
    }
  };

  // Install Slack app
  const handleSlackInstall = async () => {
    try {
      setInstalling(true);
      
      // This would typically redirect to Slack OAuth
      // For now, simulate the installation process
      const installResponse = await functions.createExecution(
        'slack-install',
        JSON.stringify({
          adminUserId: currentUser?.$id,
          timestamp: new Date().toISOString()
        })
      );

      const result = JSON.parse(installResponse.responseBody || '{}');
      
      if (result.success && result.oauthUrl) {
        // Redirect to Slack OAuth
        window.location.href = result.oauthUrl;
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (err) {
      console.error('Slack installation failed:', err);
      setError('Slack installation failed');
    } finally {
      setInstalling(false);
    }
  };

  // Update integration settings
  const updateIntegrationSettings = async (integrationId: string, settings: Partial<SlackIntegration['settings']>) => {
    try {
      const response = await functions.createExecution(
        'slack-update-settings',
        JSON.stringify({
          integrationId,
          settings,
          updatedBy: currentUser?.$id
        })
      );

      const result = JSON.parse(response.responseBody || '{}');
      
      if (result.success) {
        // Update local state
        setIntegrations(prev => 
          prev.map(integration => 
            integration.$id === integrationId
              ? { ...integration, settings: { ...integration.settings, ...settings } }
              : integration
          )
        );

        // Success feedback
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = 'Slack integration settings updated';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
      } else {
        throw new Error(result.error || 'Settings update failed');
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // Test webhook
  const testWebhook = async (integrationId: string) => {
    try {
      setTestingWebhook(integrationId);

      const response = await functions.createExecution(
        'slack-test-webhook',
        JSON.stringify({
          integrationId,
          testMessage: 'Recognition System Test - This is a test message from your recognition bot!',
          testedBy: currentUser?.$id
        })
      );

      const result = JSON.parse(response.responseBody || '{}');
      
      if (result.success) {
        // Success feedback
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = 'Test message sent successfully';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 2000);
      } else {
        throw new Error(result.error || 'Test failed');
      }
    } catch (err) {
      console.error('Webhook test failed:', err);
    } finally {
      setTestingWebhook(null);
    }
  };

  // Deactivate integration
  const deactivateIntegration = async (integrationId: string) => {
    try {
      const response = await functions.createExecution(
        'slack-deactivate',
        JSON.stringify({
          integrationId,
          deactivatedBy: currentUser?.$id
        })
      );

      const result = JSON.parse(response.responseBody || '{}');
      
      if (result.success) {
        setIntegrations(prev => 
          prev.map(integration => 
            integration.$id === integrationId
              ? { ...integration, isActive: false }
              : integration
          )
        );
      } else {
        throw new Error(result.error || 'Deactivation failed');
      }
    } catch (err) {
      console.error('Failed to deactivate integration:', err);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return diffInMinutes + ' minutes ago';
    if (diffInMinutes < 1440) return Math.floor(diffInMinutes / 60) + ' hours ago';
    return Math.floor(diffInMinutes / 1440) + ' days ago';
  };

  useEffect(() => {
    loadIntegrations();
  }, [currentUser]);

  if (!currentUser || !isAdmin()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-red-700">Admin permissions required to manage Slack integrations.</p>
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
            <p className="text-gray-600">Loading Slack integrations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Slack Integration</h1>
        <p className="text-gray-600">
          Manage Slack bot integrations for recognition notifications and slash commands
        </p>
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
              <button
                onClick={loadIntegrations}
                className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install New Integration */}
      {integrations.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 0 2.122 1.13A2.543 2.543 0 0 0 9.685 14.8l1.693-1.693a2.543 2.543 0 0 0 0-3.59L8.635 6.765a2.528 2.528 0 0 0-3.593 0 2.543 2.543 0 0 0 0 3.59l1.693 1.693a2.528 2.528 0 0 0-1.693.117zm7.742-9.793a2.543 2.543 0 0 0-3.59 0L7.5 7.065a2.543 2.543 0 0 0 0 3.59l2.753 2.753a2.528 2.528 0 0 0 3.593 0 2.543 2.543 0 0 0 0-3.59L12.153 7.125a2.528 2.528 0 0 0 .63-1.753z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Slack</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Install the Recognition Bot to your Slack workspace to enable automatic notifications and slash commands for giving recognition.
            </p>
            <button
              onClick={handleSlackInstall}
              disabled={installing}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 0 2.122 1.13A2.543 2.543 0 0 0 9.685 14.8l1.693-1.693a2.543 2.543 0 0 0 0-3.59L8.635 6.765a2.528 2.528 0 0 0-3.593 0 2.543 2.543 0 0 0 0 3.59l1.693 1.693a2.528 2.528 0 0 0-1.693.117zm7.742-9.793a2.543 2.543 0 0 0-3.59 0L7.5 7.065a2.543 2.543 0 0 0 0 3.59l2.753 2.753a2.528 2.528 0 0 0 3.593 0 2.543 2.543 0 0 0 0-3.59L12.153 7.125a2.528 2.528 0 0 0 .63-1.753z"/>
              </svg>
              {installing ? 'Connecting...' : 'Add to Slack'}
            </button>
          </div>
        </div>
      )}

      {/* Active Integrations */}
      {integrations.length > 0 && (
        <div className="grid gap-6 mb-8">
          {integrations.map((integration) => (
            <div key={integration.$id} className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5.042 15.165a2.528 2.528 0 0 0 2.122 1.13A2.543 2.543 0 0 0 9.685 14.8l1.693-1.693a2.543 2.543 0 0 0 0-3.59L8.635 6.765a2.528 2.528 0 0 0-3.593 0 2.543 2.543 0 0 0 0 3.59l1.693 1.693a2.528 2.528 0 0 0-1.693.117zm7.742-9.793a2.543 2.543 0 0 0-3.59 0L7.5 7.065a2.543 2.543 0 0 0 0 3.59l2.753 2.753a2.528 2.528 0 0 0 3.593 0 2.543 2.543 0 0 0 0-3.59L12.153 7.125a2.528 2.528 0 0 0 .63-1.753z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{integration.teamName}</h3>
                      <div className="text-sm text-gray-500">
                        {integration.channelName ? `#${integration.channelName}` : 'All channels'}
                        <span className="mx-2">•</span>
                        Installed {formatRelativeTime(integration.installedAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      integration.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {integration.isActive ? 'Active' : 'Inactive'}
                    </span>
                    
                    <button
                      onClick={() => testWebhook(integration.$id)}
                      disabled={testingWebhook === integration.$id || !integration.isActive}
                      className="px-3 py-1 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingWebhook === integration.$id ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={integration.settings.notifyOnRecognition}
                      onChange={(e) => updateIntegrationSettings(integration.$id, {
                        notifyOnRecognition: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Recognition notifications</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={integration.settings.notifyOnVerification}
                      onChange={(e) => updateIntegrationSettings(integration.$id, {
                        notifyOnVerification: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Verification notifications</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={integration.settings.allowSlashCommands}
                      onChange={(e) => updateIntegrationSettings(integration.$id, {
                        allowSlashCommands: e.target.checked
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Slash commands</span>
                  </label>

                  <div className="flex items-center">
                    <label htmlFor={`visibility-${integration.$id}`} className="text-sm text-gray-700 mr-2">
                      Default visibility:
                    </label>
                    <select
                      id={`visibility-${integration.$id}`}
                      value={integration.settings.defaultVisibility}
                      onChange={(e) => updateIntegrationSettings(integration.$id, {
                        defaultVisibility: e.target.value as any
                      })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      aria-label="Default visibility for Slack recognitions"
                    >
                      <option value="PRIVATE">Private</option>
                      <option value="TEAM">Team</option>
                      <option value="PUBLIC">Public</option>
                    </select>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => deactivateIntegration(integration.$id)}
                    className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    Deactivate Integration
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Documentation */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Slack Commands</h3>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-md p-3">
              <code className="text-sm font-mono text-gray-800">/recognize @username "Great job on the project!" #teamwork #innovation</code>
              <p className="text-sm text-gray-600 mt-1">Give recognition with tags</p>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <code className="text-sm font-mono text-gray-800">/recognize-private @username "Confidential feedback"</code>
              <p className="text-sm text-gray-600 mt-1">Give private recognition</p>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <code className="text-sm font-mono text-gray-800">/recognition-stats</code>
              <p className="text-sm text-gray-600 mt-1">View your recognition statistics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Log */}
      {notificationLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {notificationLogs.map((log) => (
                <div key={log.$id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      log.success ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{log.type.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-600 truncate max-w-md">{log.message}</p>
                      {log.error && (
                        <p className="text-sm text-red-600">{log.error}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{formatRelativeTime(log.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}