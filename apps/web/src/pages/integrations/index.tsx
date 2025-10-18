// Integrations Page - Slack, Teams, and Integration Management
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { getFunctions } from '../../appwrite/client';

interface Integration {
  id: string;
  name: string;
  description: string;
  provider: 'slack' | 'teams' | 'webhook' | 'zapier';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  connectedAt?: string;
  lastUsed?: string;
  settings?: Record<string, any>;
  iconUrl: string;
  isPopular?: boolean;
}

interface WebhookIntegration {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  lastTriggered?: string;
  secret: string;
}

export default function IntegrationsPage(): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const t = useI18n;
  const functions = getFunctions();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      
      // Mock data for integrations
      setIntegrations([
        {
          id: 'slack',
          name: 'Slack',
          description: 'Send recognition notifications to Slack channels and enable recognition commands',
          provider: 'slack',
          status: 'disconnected',
          iconUrl: '/icons/slack.svg',
          isPopular: true
        },
        {
          id: 'teams',
          name: 'Microsoft Teams',
          description: 'Integrate with Teams for notifications and bot commands',
          provider: 'teams',
          status: 'disconnected',
          iconUrl: '/icons/teams.svg',
          isPopular: true
        },
        {
          id: 'zapier',
          name: 'Zapier',
          description: 'Connect to 5000+ apps via Zapier workflows',
          provider: 'zapier',
          status: 'disconnected',
          iconUrl: '/icons/zapier.svg'
        }
      ]);

      setWebhooks([
        {
          id: 'webhook-1',
          name: 'Recognition Events',
          url: 'https://api.example.com/webhooks/recognition',
          events: ['recognition.created', 'recognition.verified'],
          status: 'active',
          createdAt: '2024-01-15T10:30:00Z',
          lastTriggered: '2024-01-20T14:25:00Z',
          secret: 'wh_sec_****'
        }
      ]);

    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integration: Integration) => {
    try {
      if (integration.provider === 'slack') {
        // Redirect to Slack OAuth
        const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.REACT_APP_SLACK_CLIENT_ID}&scope=commands,chat:write,channels:read&redirect_uri=${encodeURIComponent(window.location.origin + '/integrations/slack/callback')}`;
        window.location.href = slackUrl;
      } else if (integration.provider === 'teams') {
        // Redirect to Teams OAuth
        const teamsUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.REACT_APP_TEAMS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin + '/integrations/teams/callback')}&scope=https://graph.microsoft.com/ChannelMessage.Send`;
        window.location.href = teamsUrl;
      } else if (integration.provider === 'zapier') {
        // Open Zapier integration page
        window.open('https://zapier.com/apps/recognition/integrations', '_blank');
      }
    } catch (error) {
      console.error('Failed to connect integration:', error);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    try {
      await functions.createExecution(
        'disconnect-integration',
        JSON.stringify({ integrationId: integration.id })
      );
      
      setIntegrations(prev => 
        prev.map(int => 
          int.id === integration.id 
            ? { ...int, status: 'disconnected', connectedAt: undefined, lastUsed: undefined }
            : int
        )
      );
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
    }
  };

  const handleTestIntegration = async (integration: Integration) => {
    try {
      await functions.createExecution(
        'test-integration',
        JSON.stringify({ integrationId: integration.id })
      );
      
      alert(t('integrations.testSent'));
    } catch (error) {
      console.error('Failed to test integration:', error);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('integrations.accessDenied')}
          </h2>
          <p className="text-gray-600">
            {t('integrations.signInRequired')}
          </p>
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
              {t('integrations.title')}
            </h1>
            <p className="mt-2 text-gray-600">
              {t('integrations.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Popular Integrations */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t('integrations.popular.title')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.filter(int => int.isPopular).map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConnect={() => handleConnect(integration)}
                    onDisconnect={() => handleDisconnect(integration)}
                    onTest={() => handleTestIntegration(integration)}
                    onConfigure={() => setSelectedIntegration(integration)}
                  />
                ))}
              </div>
            </div>

            {/* All Integrations */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t('integrations.all.title')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.filter(int => !int.isPopular).map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConnect={() => handleConnect(integration)}
                    onDisconnect={() => handleDisconnect(integration)}
                    onTest={() => handleTestIntegration(integration)}
                    onConfigure={() => setSelectedIntegration(integration)}
                  />
                ))}
              </div>
            </div>

            {/* Webhooks Section */}
            {hasRole('MANAGER') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {t('integrations.webhooks.title')}
                  </h2>
                  <button
                    onClick={() => setShowWebhookModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {t('integrations.webhooks.add')}
                  </button>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {webhooks.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-gray-500">
                        {t('integrations.webhooks.empty')}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('integrations.webhooks.name')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('integrations.webhooks.url')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('integrations.webhooks.status')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('integrations.webhooks.lastTriggered')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('common.actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {webhooks.map((webhook) => (
                            <tr key={webhook.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {webhook.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {webhook.events.join(', ')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 font-mono">
                                  {webhook.url}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  webhook.status === 'active' ? 'bg-green-100 text-green-800' :
                                  webhook.status === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {t(`integrations.webhooks.status.${webhook.status}`)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {webhook.lastTriggered 
                                  ? new Date(webhook.lastTriggered).toLocaleDateString()
                                  : t('common.never')
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button className="text-blue-600 hover:text-blue-900 mr-3">
                                  {t('common.edit')}
                                </button>
                                <button className="text-red-600 hover:text-red-900">
                                  {t('common.delete')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Integration Configuration Modal */}
      {selectedIntegration && (
        <IntegrationConfigModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onSave={(settings) => {
            // Handle saving integration settings
            setSelectedIntegration(null);
          }}
        />
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <WebhookModal
          onClose={() => setShowWebhookModal(false)}
          onSave={(webhook) => {
            setWebhooks(prev => [...prev, webhook]);
            setShowWebhookModal(false);
          }}
        />
      )}
    </div>
  );
}

// Integration Card Component
interface IntegrationCardProps {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
  onConfigure: () => void;
}

function IntegrationCard({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onTest, 
  onConfigure 
}: IntegrationCardProps): React.ReactElement {
  const t = useI18n;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <img 
              src={integration.iconUrl} 
              alt={integration.name}
              className="w-8 h-8"
              onError={(e) => {
                // Fallback to first letter if icon fails
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) {
                  fallback.classList.remove('hidden');
                }
              }}
            />
            <div 
              className="w-8 h-8 bg-blue-500 text-white rounded font-semibold text-lg flex items-center justify-center hidden" 
            >
              {integration.name.charAt(0)}
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">
              {integration.name}
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              integration.status === 'connected' ? 'bg-green-100 text-green-800' :
              integration.status === 'error' ? 'bg-red-100 text-red-800' :
              integration.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {t(`integrations.status.${integration.status}`)}
            </span>
          </div>
        </div>
      </div>
      
      <p className="mt-4 text-sm text-gray-600">
        {integration.description}
      </p>

      {integration.connectedAt && (
        <p className="mt-2 text-xs text-gray-500">
          {t('integrations.connectedAt')}: {new Date(integration.connectedAt).toLocaleDateString()}
        </p>
      )}

      <div className="mt-6 flex space-x-3">
        {integration.status === 'connected' ? (
          <>
            <button
              onClick={onTest}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {t('integrations.test')}
            </button>
            <button
              onClick={onConfigure}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('integrations.configure')}
            </button>
            <button
              onClick={onDisconnect}
              className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {t('integrations.disconnect')}
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('integrations.connect')}
          </button>
        )}
      </div>
    </div>
  );
}

// Integration Configuration Modal
interface IntegrationConfigModalProps {
  integration: Integration;
  onClose: () => void;
  onSave: (settings: Record<string, any>) => void;
}

function IntegrationConfigModal({ 
  integration, 
  onClose, 
  onSave 
}: IntegrationConfigModalProps): React.ReactElement {
  const t = useI18n;
  const [settings, setSettings] = useState(integration.settings || {});

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('integrations.configure')} {integration.name}
          </h3>
          
          {integration.provider === 'slack' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="slack-channel" className="block text-sm font-medium text-gray-700">
                  {t('integrations.slack.defaultChannel')}
                </label>
                <input
                  id="slack-channel"
                  type="text"
                  value={settings.defaultChannel || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultChannel: e.target.value }))}
                  placeholder="#general"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnRecognition || false}
                    onChange={(e) => setSettings(prev => ({ ...prev, notifyOnRecognition: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('integrations.slack.notifyOnRecognition')}
                  </span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enableCommands || false}
                    onChange={(e) => setSettings(prev => ({ ...prev, enableCommands: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('integrations.slack.enableCommands')}
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => onSave(settings)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Webhook Modal
interface WebhookModalProps {
  onClose: () => void;
  onSave: (webhook: WebhookIntegration) => void;
}

function WebhookModal({ onClose, onSave }: WebhookModalProps): React.ReactElement {
  const t = useI18n;
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: ''
  });

  const availableEvents = [
    'recognition.created',
    'recognition.verified',
    'recognition.updated',
    'user.created',
    'user.updated'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const webhook: WebhookIntegration = {
      id: `webhook-${Date.now()}`,
      name: formData.name,
      url: formData.url,
      events: formData.events,
      status: 'active',
      createdAt: new Date().toISOString(),
      secret: formData.secret || `wh_sec_${Math.random().toString(36).substr(2, 9)}`
    };
    
    onSave(webhook);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('integrations.webhooks.add')}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="webhook-name" className="block text-sm font-medium text-gray-700">
                {t('integrations.webhooks.name')}
              </label>
              <input
                id="webhook-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700">
                {t('integrations.webhooks.url')}
              </label>
              <input
                id="webhook-url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700">
                  {t('integrations.webhooks.events')}
                </legend>
                <div className="mt-2 space-y-2">
                  {availableEvents.map((event) => (
                    <label key={event} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, events: [...prev.events, event] }));
                          } else {
                            setFormData(prev => ({ ...prev, events: prev.events.filter(e => e !== event) }));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{event}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            
            <div>
              <label htmlFor="webhook-secret" className="block text-sm font-medium text-gray-700">
                {t('integrations.webhooks.secret')} ({t('common.optional')})
              </label>
              <input
                id="webhook-secret"
                type="password"
                value={formData.secret}
                onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                placeholder={t('integrations.webhooks.secretPlaceholder')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}