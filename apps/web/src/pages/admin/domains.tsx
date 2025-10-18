import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { getFunctions } from '../../appwrite/client';

interface Domain {
  id: string;
  domain: string;
  organizationName: string;
  isVerified: boolean;
  verificationMethod: string;
  verificationRecord?: {
    type: string;
    name: string;
    value: string;
  };
  createdAt: string;
  ssoConfig?: {
    type: string;
    entityId: string;
  };
}

export default function DomainsPage() {
  const { currentUser, isAdmin } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    domain: '',
    organizationName: '',
    verificationMethod: 'dns',
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
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const functions = getFunctions();
      const response = await functions.createExecution(
        'list-domains',
        JSON.stringify({}),
        false
      );
      if (response.responseBody) {
        setDomains(JSON.parse(response.responseBody));
      }
    } catch (err) {
      setError('Failed to load domains');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const functions = getFunctions();
      const response = await functions.createExecution(
        'domain-register',
        JSON.stringify(formData),
        false
      );

      const result = JSON.parse(response.responseBody);
      if (result.success) {
        setSuccess(`Domain registered successfully. Verification record: ${JSON.stringify(result.verification)}`);
        setFormData({ domain: '', organizationName: '', verificationMethod: 'dns' });
        setShowForm(false);
        loadDomains();
      } else {
        setError(result.error || 'Failed to register domain');
      }
    } catch (err) {
      setError('Error registering domain');
      console.error(err);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      const functions = getFunctions();
      const response = await functions.createExecution(
        'domain-verify',
        JSON.stringify({ domainId }),
        false
      );

      const result = JSON.parse(response.responseBody);
      if (result.success) {
        setSuccess('Domain verified successfully');
        loadDomains();
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setError('Error verifying domain');
      console.error(err);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Domain Management</h1>
        <p>Register and manage organization domains for SSO provisioning</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="page-controls">
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'Register Domain'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleRegisterDomain}>
            <div className="form-group">
              <label htmlFor="domain">Domain</label>
              <input
                id="domain"
                type="text"
                placeholder="company.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="organizationName">Organization Name</label>
              <input
                id="organizationName"
                type="text"
                placeholder="Company Inc."
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="verificationMethod">Verification Method</label>
              <select
                id="verificationMethod"
                value={formData.verificationMethod}
                onChange={(e) => setFormData({ ...formData, verificationMethod: e.target.value })}
              >
                <option value="dns">DNS</option>
                <option value="email">Email</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary">
              Register Domain
            </button>
          </form>
        </div>
      )}

      <div className="domains-list">
        <h2>Registered Domains ({domains.length})</h2>
        {loading ? (
          <p>Loading...</p>
        ) : domains.length === 0 ? (
          <p>No domains registered yet</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Organization</th>
                  <th>Verified</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td>{domain.domain}</td>
                    <td>{domain.organizationName}</td>
                    <td>
                      <span className={`badge ${domain.isVerified ? 'badge-success' : 'badge-warning'}`}>
                        {domain.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td>{domain.verificationMethod}</td>
                    <td>
                      {!domain.isVerified && (
                        <button
                          onClick={() => handleVerifyDomain(domain.id)}
                          className="btn btn-sm btn-primary"
                        >
                          Verify
                        </button>
                      )}
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
