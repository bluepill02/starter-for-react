import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { getFunctions } from '../../appwrite/client';

export default function AuditLogExportPage() {
  const { currentUser, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'csv',
    eventCodes: [] as string[],
    includeMetadata: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check authorization
  if (!isAdmin()) {
    return (
      <div className="admin-page">
        <div className="alert alert-error">
          <p>Access Denied: Admin privileges required</p>
        </div>
      </div>
    );
  }

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const functions = getFunctions();
      const response = await functions.createExecution(
        'audit-log-export',
        JSON.stringify(formData),
        false
      );

      const result = JSON.parse(response.responseBody);
      if (result.success) {
        // Create a blob and download
        const blob = new Blob([result.data], {
          type: formData.format === 'csv' ? 'text/csv' : 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${formData.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSuccess('Audit logs exported successfully');
      } else {
        setError(result.error || 'Failed to export audit logs');
      }
    } catch (err) {
      setError('Error exporting audit logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const eventCodeOptions = [
    'RECOGNITION_CREATED',
    'RECOGNITION_VERIFIED',
    'RECOGNITION_DELETED',
    'ADMIN_OVERRIDE_SUCCESS',
    'ADMIN_OVERRIDE_FAILED',
    'AUDIT_LOG_EXPORTED',
    'DOMAIN_REGISTERED',
    'POLICY_UPDATED',
  ];

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Audit Log Export</h1>
        <p>Export audit logs for compliance and investigation</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="form-card">
        <form onSubmit={handleExport}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="startDate">Start Date</label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="format">Export Format</label>
            <select
              id="format"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="form-group">
            <label>Event Codes (select all that apply)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {eventCodeOptions.map((code) => (
                <label key={code} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.eventCodes.includes(code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          eventCodes: [...formData.eventCodes, code],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          eventCodes: formData.eventCodes.filter((c) => c !== code),
                        });
                      }
                    }}
                  />
                  {code}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={formData.includeMetadata}
                onChange={(e) => setFormData({ ...formData, includeMetadata: e.target.checked })}
              />
              Include Metadata
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Exporting...' : 'Export Audit Logs'}
          </button>
        </form>
      </div>

      <div className="info-card" style={{ marginTop: '2rem' }}>
        <h3>Privacy Notice</h3>
        <p>All exported data uses hashed identifiers for privacy. User IDs, email addresses, and evidence content are not included in exports.</p>
      </div>
    </div>
  );
}
