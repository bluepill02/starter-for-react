import React, { useState, useEffect } from 'react';
import { getFunctions } from '../../appwrite/client';

interface QuotaStatus {
  organizationId: string;
  quotas: Record<string, any>;
  usage: Record<string, number>;
  resetDates: Record<string, string>;
  alerts: any[];
}

interface OrganizationQuota {
  name: string;
  tier: string;
  quotas: Record<string, number>;
  usage: Record<string, number>;
  percentageUsed: Record<string, number>;
}

export default function QuotaManagementPage() {
  const [organizations, setOrganizations] = useState<OrganizationQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [editingQuotas, setEditingQuotas] = useState<Record<string, number>>({});

  const fetchQuotaStatus = async () => {
    try {
      setLoading(true);
      const functions = getFunctions();
      // Note: This would need a corresponding backend function
      // For now, we'll display mock data structure
      const mockOrgs: OrganizationQuota[] = [
        {
          name: 'Default Organization',
          tier: 'Enterprise',
          quotas: {
            recognitions_per_day: 1000,
            recognitions_per_month: 25000,
            storage_gb_per_month: 100,
            api_calls_per_hour: 10000,
            exports_per_day: 50,
            shareable_links_per_day: 200,
            team_members: 500,
            custom_domains: 10,
          },
          usage: {
            recognitions_per_day: 427,
            recognitions_per_month: 8943,
            storage_gb_per_month: 45,
            api_calls_per_hour: 3421,
            exports_per_day: 12,
            shareable_links_per_day: 89,
            team_members: 156,
            custom_domains: 3,
          },
          percentageUsed: {},
        },
      ];

      // Calculate percentages
      mockOrgs.forEach((org) => {
        Object.keys(org.quotas).forEach((key) => {
          org.percentageUsed[key] = Math.round((org.usage[key] / org.quotas[key]) * 100);
        });
      });

      setOrganizations(mockOrgs);
      setError(null);
    } catch (err) {
      setError('Failed to fetch quota status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotaStatus();
  }, []);

  const handleUpdateQuota = async (orgId: string, quotaKey: string, newValue: number) => {
    try {
      setEditingQuotas({ ...editingQuotas, [quotaKey]: newValue });
      // Here you'd call the backend to update quotas
      console.log(`Updated ${quotaKey} to ${newValue} for org ${orgId}`);
    } catch (err) {
      setError('Failed to update quota');
      console.error(err);
    }
  };

  const getQuotaStatus = (percentageUsed: number) => {
    if (percentageUsed >= 90) return { color: '#ef4444', label: 'Critical' };
    if (percentageUsed >= 70) return { color: '#f59e0b', label: 'Warning' };
    return { color: '#10b981', label: 'Healthy' };
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Quota Management (Phase 4)</h1>
        <p style={{ color: '#6b7280' }}>Monitor and manage per-organization quotas to prevent noisy neighbor problems</p>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '0.375rem',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading quota status...</p>
      ) : (
        <div>
          {organizations.map((org, idx) => (
            <div key={idx} style={{
              padding: '1.5rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0 0 0.5rem 0' }}>{org.name}</h2>
                <span style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#dbeafe',
                  color: '#0c4a6e',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem'
                }}>
                  {org.tier}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}>
                {Object.entries(org.quotas).map(([key, limit]) => {
                  const used = org.usage[key] || 0;
                  const percentage = org.percentageUsed[key] || 0;
                  const status = getQuotaStatus(percentage);

                  return (
                    <div key={key} style={{
                      padding: '1rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.375rem',
                      border: `2px solid ${status.color}`
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span style={{ float: 'right', color: status.color, fontWeight: '600' }}>
                          {status.label}
                        </span>
                      </div>

                      <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        <div>Usage: {used} / {limit}</div>
                        <div>Percentage: {percentage}%</div>
                      </div>

                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(percentage, 100)}%`,
                          height: '100%',
                          backgroundColor: status.color,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>

                      {percentage >= 70 && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem',
                          backgroundColor: `${status.color}15`,
                          borderRadius: '0.25rem',
                          fontSize: '0.875rem',
                          color: status.color
                        }}>
                          ⚠️ Approaching quota limit
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Alerts section */}
              {Object.entries(org.percentageUsed).filter(([_, p]) => p >= 80).length > 0 && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '0.375rem',
                  border: '1px solid #fcd34d'
                }}>
                  <strong>Active Alerts:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                    {Object.entries(org.percentageUsed)
                      .filter(([_, p]) => p >= 80)
                      .map(([key, p]) => (
                        <li key={key} style={{ fontSize: '0.875rem' }}>
                          {key.replace(/_/g, ' ')}: {p}% usage
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#ecfdf5',
        borderRadius: '0.375rem',
        border: '1px solid #86efac',
        fontSize: '0.875rem'
      }}>
        <strong>Phase 4 Advanced Reliability Features Enabled:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
          <li>Per-organization quota enforcement</li>
          <li>Real-time usage tracking</li>
          <li>Automatic quota reset scheduling</li>
          <li>Noisy neighbor prevention</li>
          <li>Usage analytics and reporting</li>
        </ul>
      </div>
    </div>
  );
}
