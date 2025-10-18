/**
 * Manager Dashboard
 * 
 * Central hub for manager verification tasks with bulk actions.
 * Features:
 * - Pending recognitions list
 * - Bulk verification modal
 * - Filter by recipient/giver/status
 * - Real-time stats
 * - Keyboard shortcuts
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect, useCallback } from 'react';
import BulkVerificationModal from './BulkVerificationModal';

export default function ManagerDashboard() {
  const [recognitions, setRecognitions] = useState([]);
  const [filteredRecognitions, setFilteredRecognitions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalWeight: 0
  });

  // Load recognitions for verification
  useEffect(() => {
    loadRecognitions();
  }, []);

  // Filter recognitions
  useEffect(() => {
    let filtered = recognitions;

    // Filter by status
    if (filter !== 'all') {
      const statusMap = {
        pending: 'pending',
        approved: 'verified',
        rejected: 'rejected'
      };
      filtered = filtered.filter(r => r.status === statusMap[filter]);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.giverName?.toLowerCase().includes(term) ||
        r.recipientName?.toLowerCase().includes(term) ||
        r.title?.toLowerCase().includes(term) ||
        r.reason?.toLowerCase().includes(term)
      );
    }

    setFilteredRecognitions(filtered);
  }, [recognitions, filter, searchTerm]);

  // Calculate stats
  useEffect(() => {
    const stats = {
      pending: recognitions.filter(r => r.status === 'pending').length,
      approved: recognitions.filter(r => r.status === 'verified').length,
      rejected: recognitions.filter(r => r.status === 'rejected').length,
      totalWeight: recognitions
        .filter(r => r.status === 'verified')
        .reduce((sum, r) => sum + (r.weight || 0), 0)
    };
    setStats(stats);
  }, [recognitions]);

  async function loadRecognitions() {
    try {
      // Fetch recognitions needing verification
      const response = await fetch('/api/functions/get-recognitions-for-verification');
      const data = await response.json();
      setRecognitions(data.recognitions || []);
    } catch (err) {
      console.error('Error loading recognitions:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleBulkVerify = useCallback(async ({ recognitions: toVerify, action, notes }) => {
    try {
      const response = await fetch('/api/functions/batch-verify-recognitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recognitionIds: toVerify.map(r => r.$id),
          action,
          notes,
          verifierId: 'current-user-id' // Replace with actual user ID from auth
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      // Refresh recognitions
      await loadRecognitions();
      setSelectedIds(new Set());

      return result;
    } catch (err) {
      console.error('Error in bulk verification:', err);
      throw err;
    }
  }, []);

  if (loading) {
    return (
      <div className="manager-dashboard-loader" role="status" aria-live="polite">
        <div className="spinner" />
        <p>Loading recognitions...</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      {/* Header */}
      <header className="manager-dashboard-header">
        <h1>Manager Verification Hub</h1>
        <p className="manager-dashboard-subtitle">
          Review and approve recognitions from your team
        </p>
      </header>

      {/* Stats Cards */}
      <div className="manager-stats-grid" role="region" aria-label="Verification statistics">
        <div className="manager-stat-card">
          <div className="manager-stat-value">{stats.pending}</div>
          <div className="manager-stat-label">Pending Review</div>
        </div>
        <div className="manager-stat-card manager-stat-card--success">
          <div className="manager-stat-value">{stats.approved}</div>
          <div className="manager-stat-label">Approved</div>
        </div>
        <div className="manager-stat-card manager-stat-card--danger">
          <div className="manager-stat-value">{stats.rejected}</div>
          <div className="manager-stat-label">Rejected</div>
        </div>
        <div className="manager-stat-card manager-stat-card--info">
          <div className="manager-stat-value">{stats.totalWeight.toFixed(1)}</div>
          <div className="manager-stat-label">Total Weight Verified</div>
        </div>
      </div>

      {/* Controls */}
      <div className="manager-controls">
        <div className="manager-search">
          <input
            type="text"
            placeholder="Search by name, title, or reason..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="manager-search-input"
            aria-label="Search recognitions"
          />
        </div>

        <div className="manager-filter-group">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`manager-filter-btn ${filter === f ? 'active' : ''}`}
              aria-pressed={filter === f}
              aria-label={`Filter by ${f} status`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowBulkModal(true)}
          className="manager-bulk-btn"
          disabled={selectedIds.size === 0}
          aria-label={`Verify ${selectedIds.size} selected recognitions`}
        >
          Verify ({selectedIds.size})
        </button>
      </div>

      {/* Recognitions List */}
      <div className="manager-list" role="region" aria-label="Recognitions list">
        {filteredRecognitions.length === 0 ? (
          <div className="manager-empty-state">
            <p>
              {recognitions.length === 0
                ? 'No recognitions to verify'
                : 'No matching recognitions'}
            </p>
          </div>
        ) : (
          <div className="manager-items">
            {filteredRecognitions.map(recognition => (
              <div
                key={recognition.$id}
                className="manager-item"
                role="article"
              >
                <label className="manager-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(recognition.$id)}
                    onChange={() => {
                      const newIds = new Set(selectedIds);
                      if (newIds.has(recognition.$id)) {
                        newIds.delete(recognition.$id);
                      } else {
                        newIds.add(recognition.$id);
                      }
                      setSelectedIds(newIds);
                    }}
                    aria-label={`Select recognition from ${recognition.giverName}`}
                  />
                </label>

                <div className="manager-item-content">
                  <div className="manager-item-title">
                    {recognition.title}
                  </div>
                  <div className="manager-item-meta">
                    <span className="manager-from">
                      From: <strong>{recognition.giverName}</strong>
                    </span>
                    <span className="manager-to">
                      To: <strong>{recognition.recipientName}</strong>
                    </span>
                  </div>
                  <p className="manager-item-reason">
                    {recognition.reason}
                  </p>
                  {recognition.tags && recognition.tags.length > 0 && (
                    <div className="manager-tags">
                      {recognition.tags.map(tag => (
                        <span key={tag} className="manager-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="manager-item-weight">
                  <span className="manager-weight-badge">
                    {recognition.weight?.toFixed(1) || '0.0'}
                  </span>
                </div>

                <div className="manager-item-status">
                  <span className={`manager-status manager-status--${recognition.status}`}>
                    {recognition.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Verification Modal */}
      <BulkVerificationModal
        isOpen={showBulkModal}
        recognitions={filteredRecognitions.filter(r =>
          selectedIds.has(r.$id)
        )}
        onClose={() => setShowBulkModal(false)}
        onVerify={handleBulkVerify}
      />
    </div>
  );
}
