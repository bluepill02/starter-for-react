// Settings Page - Personal, Team, and Organization Settings
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { getDatabase, getFunctions } from '../../appwrite/client';

interface SettingsTab {
  id: 'personal' | 'team' | 'org';
  label: string;
  requiresRole?: 'MANAGER' | 'ADMIN';
}

interface PersonalSettings {
  language: 'en' | 'ta';
  emailDigests: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  };
  quietChampion: {
    enabled: boolean;
    anonymousMode: boolean;
  };
  notifications: {
    recognitionReceived: boolean;
    recognitionVerified: boolean;
    digestReminders: boolean;
    slackNotifications: boolean;
    teamsNotifications: boolean;
  };
}

interface TeamSettings {
  sso: {
    enabled: boolean;
    provider: 'google' | 'microsoft' | 'okta' | 'custom';
    domain: string;
    autoProvisioning: boolean;
  };
  scimSync: {
    enabled: boolean;
    endpoint: string;
    lastSync: string;
    status: 'active' | 'error' | 'disabled';
  };
  dataResidency: {
    region: 'us-east' | 'eu-west' | 'ap-south';
    encryptionLevel: 'standard' | 'enhanced';
  };
  retention: {
    recognitions: number; // months
    auditLogs: number; // months
    exports: number; // months
  };
}

interface OrgSettings {
  general: {
    organizationName: string;
    timezone: string;
    fiscalYearStart: string;
  };
  security: {
    mfaRequired: boolean;
    sessionTimeout: number; // minutes
    ipWhitelist: string[];
    apiRateLimit: number;
  };
  compliance: {
    dataProcessingAgreement: boolean;
    gdprCompliance: boolean;
    auditRetention: number; // years
    exportFormats: ('pdf' | 'csv' | 'json')[];
  };
}

interface ConfirmationModal {
  isOpen: boolean;
  title: string;
  message: string;
  criticalAction: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SettingsPage(): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const t = useI18n;
  const databases = getDatabase();
  const functions = getFunctions();

  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'org'>('personal');
  const [personalSettings, setPersonalSettings] = useState<PersonalSettings | null>(null);
  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModal>({
    isOpen: false,
    title: '',
    message: '',
    criticalAction: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const tabs: SettingsTab[] = [
    { id: 'personal' as const, label: t('settings.tabs.personal') },
    { id: 'team' as const, label: t('settings.tabs.team'), requiresRole: 'MANAGER' as const },
    { id: 'org' as const, label: t('settings.tabs.organization'), requiresRole: 'ADMIN' as const }
  ].filter(tab => !tab.requiresRole || hasRole(tab.requiresRole as any));

  useEffect(() => {
    loadSettings();
  }, [activeTab]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'personal') {
        // Mock data for personal settings
        setPersonalSettings({
          language: 'en',
          emailDigests: { daily: false, weekly: true, monthly: false },
          quietChampion: { enabled: false, anonymousMode: false },
          notifications: {
            recognitionReceived: true,
            recognitionVerified: true,
            digestReminders: true,
            slackNotifications: false,
            teamsNotifications: false
          }
        });
      } else if (activeTab === 'team' && hasRole('MANAGER')) {
        // Mock data for team settings
        setTeamSettings({
          sso: {
            enabled: false,
            provider: 'google',
            domain: '',
            autoProvisioning: false
          },
          scimSync: {
            enabled: false,
            endpoint: '',
            lastSync: '',
            status: 'disabled'
          },
          dataResidency: {
            region: 'us-east',
            encryptionLevel: 'standard'
          },
          retention: {
            recognitions: 12,
            auditLogs: 24,
            exports: 6
          }
        });
      } else if (activeTab === 'org' && hasRole('ADMIN')) {
        // Mock data for org settings
        setOrgSettings({
          general: {
            organizationName: 'Acme Corporation',
            timezone: 'America/New_York',
            fiscalYearStart: '2024-01-01'
          },
          security: {
            mfaRequired: false,
            sessionTimeout: 60,
            ipWhitelist: [],
            apiRateLimit: 1000
          },
          compliance: {
            dataProcessingAgreement: true,
            gdprCompliance: true,
            auditRetention: 7,
            exportFormats: ['pdf', 'csv']
          }
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (settings: any, isCritical = false) => {
    if (isCritical) {
      setConfirmationModal({
        isOpen: true,
        title: t('settings.confirmModal.title'),
        message: t('settings.confirmModal.criticalMessage'),
        criticalAction: t('settings.confirmModal.saveChanges'),
        onConfirm: () => executeSave(settings, true),
        onCancel: () => setConfirmationModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    
    await executeSave(settings, false);
  };

  const executeSave = async (settings: any, isCritical: boolean) => {
    try {
      setSaving(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh settings
      await loadSettings();
      
      if (isCritical) {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('settings.accessDenied')}
          </h2>
          <p className="text-gray-600">
            {t('settings.signInRequired')}
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
              {t('settings.title')}
            </h1>
            <p className="mt-2 text-gray-600">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[600px]">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6 pt-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {activeTab === 'personal' && personalSettings && (
                  <PersonalSettingsTab 
                    settings={personalSettings}
                    onSave={(settings) => handleSave(settings)}
                    saving={saving}
                  />
                )}
                {activeTab === 'team' && teamSettings && hasRole('MANAGER') && (
                  <TeamSettingsTab 
                    settings={teamSettings}
                    onSave={(settings, isCritical) => handleSave(settings, isCritical)}
                    saving={saving}
                  />
                )}
                {activeTab === 'org' && orgSettings && hasRole('ADMIN') && (
                  <OrgSettingsTab 
                    settings={orgSettings}
                    onSave={(settings, isCritical) => handleSave(settings, isCritical)}
                    saving={saving}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">
                {confirmationModal.title}
              </h3>
              <div className="mt-4 px-7 py-3">
                <p className="text-sm text-gray-500">
                  {confirmationModal.message}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={confirmationModal.onCancel}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmationModal.onConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {confirmationModal.criticalAction}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Personal Settings Tab Component
interface PersonalSettingsTabProps {
  settings: PersonalSettings;
  onSave: (settings: PersonalSettings) => void;
  saving: boolean;
}

function PersonalSettingsTab({ settings, onSave, saving }: PersonalSettingsTabProps): React.ReactElement {
  const t = useI18n;
  const [formData, setFormData] = useState<PersonalSettings>(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('settings.personal.title')}
        </h3>
        
        {/* Language Settings */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.personal.language.label')}
            </label>
            <p className="text-sm text-gray-500 mt-1">
              {t('settings.personal.language.help')}
            </p>
            <select
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as 'en' | 'ta' }))}
              className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              aria-label={t('settings.personal.language.label')}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>

          {/* Email Digest Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.personal.emailDigests.label')}
            </label>
            <p className="text-sm text-gray-500 mt-1">
              {t('settings.personal.emailDigests.help')}
            </p>
            <div className="mt-2 space-y-2">
              {(['daily', 'weekly', 'monthly'] as const).map((frequency) => (
                <label key={frequency} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.emailDigests[frequency]}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      emailDigests: { ...prev.emailDigests, [frequency]: e.target.checked }
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t(`settings.personal.emailDigests.${frequency}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Quiet Champion Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.personal.quietChampion.label')}
            </label>
            <p className="text-sm text-gray-500 mt-1">
              {t('settings.personal.quietChampion.help')}
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.quietChampion.enabled}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    quietChampion: { ...prev.quietChampion, enabled: e.target.checked }
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t('settings.personal.quietChampion.enabled')}
                </span>
              </label>
              {formData.quietChampion.enabled && (
                <label className="flex items-center ml-6">
                  <input
                    type="checkbox"
                    checked={formData.quietChampion.anonymousMode}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      quietChampion: { ...prev.quietChampion, anonymousMode: e.target.checked }
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t('settings.personal.quietChampion.anonymous')}
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Notification Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.personal.notifications.label')}
            </label>
            <p className="text-sm text-gray-500 mt-1">
              {t('settings.personal.notifications.help')}
            </p>
            <div className="mt-2 space-y-2">
              {Object.entries(formData.notifications).map(([key, value]) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, [key]: e.target.checked }
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {t(`settings.personal.notifications.${key}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </div>
    </form>
  );
}

// Team Settings Tab Component
interface TeamSettingsTabProps {
  settings: TeamSettings;
  onSave: (settings: TeamSettings, isCritical?: boolean) => void;
  saving: boolean;
}

function TeamSettingsTab({ settings, onSave, saving }: TeamSettingsTabProps): React.ReactElement {
  const t = useI18n;
  const [formData, setFormData] = useState<TeamSettings>(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if any critical settings have changed
    const isCritical = 
      formData.sso.enabled !== settings.sso.enabled ||
      formData.scimSync.enabled !== settings.scimSync.enabled ||
      formData.dataResidency.region !== settings.dataResidency.region;
    
    onSave(formData, isCritical);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-6">
          {t('settings.team.title')}
        </h3>
        
        {/* SSO Settings */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.team.sso.title')}
          </h4>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.sso.enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  sso: { ...prev.sso, enabled: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {t('settings.team.sso.enabled')}
              </span>
            </label>
            
            {formData.sso.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('settings.team.sso.provider')}
                  </label>
                  <select
                    value={formData.sso.provider}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      sso: { ...prev.sso, provider: e.target.value as any }
                    }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    aria-label={t('settings.team.sso.provider')}
                  >
                    <option value="google">Google Workspace</option>
                    <option value="microsoft">Microsoft Azure AD</option>
                    <option value="okta">Okta</option>
                    <option value="custom">Custom SAML</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('settings.team.sso.domain')}
                  </label>
                  <input
                    type="text"
                    value={formData.sso.domain}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      sso: { ...prev.sso, domain: e.target.value }
                    }))}
                    placeholder="company.com"
                    aria-label={t('settings.team.sso.domain')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* SCIM Sync Settings */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.team.scim.title')}
          </h4>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.scimSync.enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  scimSync: { ...prev.scimSync, enabled: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {t('settings.team.scim.enabled')}
              </span>
            </label>
            
            {formData.scimSync.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('settings.team.scim.endpoint')}
                  </label>
                  <input
                    type="url"
                    value={formData.scimSync.endpoint}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      scimSync: { ...prev.scimSync, endpoint: e.target.value }
                    }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t('settings.team.scim.lastSync')}
                    </span>
                    <p className="text-sm text-gray-500">
                      {formData.scimSync.lastSync || t('settings.team.scim.neverSynced')}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    formData.scimSync.status === 'active' ? 'bg-green-100 text-green-800' :
                    formData.scimSync.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {t(`settings.team.scim.status.${formData.scimSync.status}`)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Residency */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.team.dataResidency.title')}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.team.dataResidency.region')}
              </label>
              <select
                value={formData.dataResidency.region}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  dataResidency: { ...prev.dataResidency, region: e.target.value as any }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="us-east">United States (East)</option>
                <option value="eu-west">European Union (West)</option>
                <option value="ap-south">Asia Pacific (South)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.team.dataResidency.encryption')}
              </label>
              <select
                value={formData.dataResidency.encryptionLevel}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  dataResidency: { ...prev.dataResidency, encryptionLevel: e.target.value as any }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="standard">Standard Encryption</option>
                <option value="enhanced">Enhanced Encryption</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </div>
    </form>
  );
}

// Organization Settings Tab Component
interface OrgSettingsTabProps {
  settings: OrgSettings;
  onSave: (settings: OrgSettings, isCritical?: boolean) => void;
  saving: boolean;
}

function OrgSettingsTab({ settings, onSave, saving }: OrgSettingsTabProps): React.ReactElement {
  const t = useI18n;
  const [formData, setFormData] = useState<OrgSettings>(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if any critical settings have changed
    const isCritical = 
      formData.security.mfaRequired !== settings.security.mfaRequired ||
      formData.compliance.gdprCompliance !== settings.compliance.gdprCompliance ||
      formData.security.sessionTimeout !== settings.security.sessionTimeout;
    
    onSave(formData, isCritical);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-6">
          {t('settings.org.title')}
        </h3>
        
        {/* General Settings */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.org.general.title')}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.org.general.name')}
              </label>
              <input
                type="text"
                value={formData.general.organizationName}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  general: { ...prev.general, organizationName: e.target.value }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.org.general.timezone')}
              </label>
              <select
                value={formData.general.timezone}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  general: { ...prev.general, timezone: e.target.value }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">GMT</option>
                <option value="Asia/Kolkata">IST</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.org.security.title')}
          </h4>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.security.mfaRequired}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  security: { ...prev.security, mfaRequired: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {t('settings.org.security.mfaRequired')}
              </span>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.org.security.sessionTimeout')}
              </label>
              <select
                value={formData.security.sessionTimeout}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="480">8 hours</option>
                <option value="1440">24 hours</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compliance Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {t('settings.org.compliance.title')}
          </h4>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.compliance.gdprCompliance}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  compliance: { ...prev.compliance, gdprCompliance: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {t('settings.org.compliance.gdpr')}
              </span>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.org.compliance.auditRetention')}
              </label>
              <select
                value={formData.compliance.auditRetention}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  compliance: { ...prev.compliance, auditRetention: parseInt(e.target.value) }
                }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1">1 year</option>
                <option value="3">3 years</option>
                <option value="5">5 years</option>
                <option value="7">7 years</option>
                <option value="10">10 years</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </div>
    </form>
  );
}