import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { getFunctions } from '../../appwrite/client';

interface CompliancePolicy {
  id: string;
  policyName: string;
  dataRetentionDays: number;
  requiresVerification: boolean;
  evidenceRequiredForManager: number;
  evidenceRequiredForAdmin: number;
  createdAt: string;
  updatedAt: string;
}

export default function CompliancePolicyPage() {
  const { currentUser, isAdmin } = useAuth();
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    policyName: '',
    dataRetentionDays: 90,
    requiresVerification: true,
    evidenceRequiredForManager: 1,
    evidenceRequiredForAdmin: 0,
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

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const functions = getFunctions();
      const response = await functions.createExecution(
        'compliance-policy-list',
        JSON.stringify({}),
        false
      );
      if (response.responseBody) {
        setPolicies(JSON.parse(response.responseBody));
      }
    } catch (err) {
      setError('Failed to load policies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const functions = getFunctions();
      const endpoint = editingId ? 'compliance-policy-update' : 'compliance-policy-create';
      const payload = editingId ? { id: editingId, ...formData } : formData;

      const response = await functions.createExecution(
        endpoint,
        JSON.stringify(payload),
        false
      );

      const result = JSON.parse(response.responseBody);
      if (result.success) {
        setSuccess(`Policy ${editingId ? 'updated' : 'created'} successfully`);
        setFormData({
          policyName: '',
          dataRetentionDays: 90,
          requiresVerification: true,
          evidenceRequiredForManager: 1,
          evidenceRequiredForAdmin: 0,
        });
        setEditingId(null);
        setShowForm(false);
        loadPolicies();
      } else {
        setError(result.error || 'Failed to save policy');
      }
    } catch (err) {
      setError('Error saving policy');
      console.error(err);
    }
  };

  const handleEditPolicy = (policy: CompliancePolicy) => {
    setFormData({
      policyName: policy.policyName,
      dataRetentionDays: policy.dataRetentionDays,
      requiresVerification: policy.requiresVerification,
      evidenceRequiredForManager: policy.evidenceRequiredForManager,
      evidenceRequiredForAdmin: policy.evidenceRequiredForAdmin,
    });
    setEditingId(policy.id);
    setShowForm(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return;

    try {
      const functions = getFunctions();
      const response = await functions.createExecution(
        'compliance-policy-delete',
        JSON.stringify({ id: policyId }),
        false
      );

      const result = JSON.parse(response.responseBody);
      if (result.success) {
        setSuccess('Policy deleted successfully');
        loadPolicies();
      } else {
        setError(result.error || 'Failed to delete policy');
      }
    } catch (err) {
      setError('Error deleting policy');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      policyName: '',
      dataRetentionDays: 90,
      requiresVerification: true,
      evidenceRequiredForManager: 1,
      evidenceRequiredForAdmin: 0,
    });
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Compliance Policies</h1>
        <p>Manage organization-level compliance policies and controls</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="page-controls">
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'Create Policy'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleSavePolicy}>
            <div className="form-group">
              <label htmlFor="policyName">Policy Name</label>
              <input
                id="policyName"
                type="text"
                placeholder="e.g., Standard Policy"
                value={formData.policyName}
                onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="dataRetentionDays">Data Retention (Days)</label>
              <input
                id="dataRetentionDays"
                type="number"
                min="1"
                max="3650"
                value={formData.dataRetentionDays}
                onChange={(e) => setFormData({ ...formData, dataRetentionDays: parseInt(e.target.value) })}
                required
              />
              <small>Data older than this will be automatically deleted</small>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.requiresVerification}
                  onChange={(e) => setFormData({ ...formData, requiresVerification: e.target.checked })}
                />
                Requires Manager Verification
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="evidenceRequiredForManager">Evidence Required for Manager</label>
              <input
                id="evidenceRequiredForManager"
                type="number"
                min="0"
                max="10"
                value={formData.evidenceRequiredForManager}
                onChange={(e) => setFormData({ ...formData, evidenceRequiredForManager: parseInt(e.target.value) })}
              />
              <small>Minimum evidence items required for manager recognitions</small>
            </div>

            <div className="form-group">
              <label htmlFor="evidenceRequiredForAdmin">Evidence Required for Admin</label>
              <input
                id="evidenceRequiredForAdmin"
                type="number"
                min="0"
                max="10"
                value={formData.evidenceRequiredForAdmin}
                onChange={(e) => setFormData({ ...formData, evidenceRequiredForAdmin: parseInt(e.target.value) })}
              />
              <small>Minimum evidence items required for admin recognitions</small>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update Policy' : 'Create Policy'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="policies-list">
        <h2>Policies ({policies.length})</h2>
        {loading ? (
          <p>Loading...</p>
        ) : policies.length === 0 ? (
          <p>No policies configured yet</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Retention</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>{policy.policyName}</td>
                    <td>{policy.dataRetentionDays} days</td>
                    <td>{policy.requiresVerification ? 'Required' : 'Optional'}</td>
                    <td>
                      <button
                        onClick={() => handleEditPolicy(policy)}
                        className="btn btn-sm btn-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
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
  );
}
