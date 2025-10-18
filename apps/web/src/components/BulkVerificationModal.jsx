/**
 * Bulk Verification Component
 * 
 * Manager UI for reviewing and approving/rejecting multiple recognitions
 * simultaneously. Features:
 * - Multi-select with checkbox all/none toggles
 * - Batch approve/reject with custom notes
 * - Progress tracking and status indicators
 * - Keyboard navigation (Tab, Space, Enter, Escape)
 * - WCAG 2.1 AA compliant
 * - Dark mode support
 * 
 * Usage: <BulkVerificationModal isOpen={true} recognitions={[...]} onClose={() => {}} />
 */

import { useState, useCallback } from 'react';

const BulkVerificationModal = ({
  isOpen,
  recognitions = [],
  onClose,
  onVerify
}) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [verificationNotes, setVerificationNotes] = useState('');
  const [action, setAction] = useState(null); // 'approve' or 'reject'
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  // Toggle individual selection
  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Select all / Deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === recognitions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recognitions.map(r => r.$id)));
    }
  }, [recognitions, selectedIds.size]);

  // Handle bulk verification
  const handleBulkAction = useCallback(async (actionType) => {
    if (selectedIds.size === 0) {
      setError('Please select at least one recognition to verify');
      return;
    }

    setAction(actionType);
    setProcessing(true);
    setError(null);

    try {
      const selectedRecognitions = recognitions.filter(r => 
        selectedIds.has(r.$id)
      );

      const results = await onVerify({
        recognitions: selectedRecognitions,
        action: actionType,
        notes: verificationNotes
      });

      setSuccessCount(results?.successCount || selectedIds.size);
      setSelectedIds(new Set());
      setVerificationNotes('');

      // Show success briefly then close
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to process verification');
    } finally {
      setProcessing(false);
    }
  }, [selectedIds, recognitions, verificationNotes, onVerify, onClose]);

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === recognitions.length && recognitions.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < recognitions.length;

  return (
    <div className="bulk-verification-overlay" onClick={() => !processing && onClose()}>
      <div
        className="bulk-verification-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="bulk-verify-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bulk-verify-header">
          <h2 id="bulk-verify-title">Bulk Verification</h2>
          <button
            onClick={() => !processing && onClose()}
            className="bulk-verify-close"
            aria-label="Close bulk verification modal"
            disabled={processing}
          >
            ✕
          </button>
        </div>

        {/* Selection Controls */}
        <div className="bulk-verify-controls">
          <label className="bulk-verify-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => {
                if (el && someSelected) el.indeterminate = true;
              }}
              onChange={toggleSelectAll}
              disabled={processing}
              aria-label={allSelected ? 'Deselect all' : 'Select all'}
            />
            <span>
              {allSelected
                ? `All ${recognitions.length} selected`
                : someSelected
                ? `${selectedCount} of ${recognitions.length} selected`
                : `Select ${recognitions.length} recognitions`}
            </span>
          </label>
        </div>

        {/* Recognitions List */}
        <div
          className="bulk-verify-list"
          role="region"
          aria-label="Recognitions to verify"
        >
          {recognitions.length === 0 ? (
            <p className="bulk-verify-empty">No recognitions to verify</p>
          ) : (
            recognitions.map((recognition) => (
              <div
                key={recognition.$id}
                className={`bulk-verify-item ${selectedIds.has(recognition.$id) ? 'selected' : ''}`}
                role="row"
                aria-selected={selectedIds.has(recognition.$id)}
              >
                <label className="bulk-verify-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(recognition.$id)}
                    onChange={() => toggleSelection(recognition.$id)}
                    disabled={processing}
                    aria-label={`Select recognition from ${recognition.giverName || 'Unknown'} to ${recognition.recipientName || 'Unknown'}`}
                  />
                </label>

                <div className="bulk-verify-content">
                  <div className="bulk-verify-title">
                    {recognition.title || 'Untitled Recognition'}
                  </div>
                  <div className="bulk-verify-meta">
                    <span className="bulk-verify-giver">
                      From: {recognition.giverName || 'Unknown'}
                    </span>
                    <span className="bulk-verify-separator">•</span>
                    <span className="bulk-verify-recipient">
                      To: {recognition.recipientName || 'Unknown'}
                    </span>
                  </div>
                  <p className="bulk-verify-reason">
                    {recognition.reason}
                  </p>
                  {recognition.tags && recognition.tags.length > 0 && (
                    <div className="bulk-verify-tags">
                      {recognition.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="bulk-verify-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bulk-verify-weight">
                  <span className="bulk-verify-badge">
                    {recognition.weight?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes Field */}
        {selectedCount > 0 && (
          <div className="bulk-verify-notes">
            <label htmlFor="bulk-verify-notes-input">
              Verification Notes (optional)
            </label>
            <textarea
              id="bulk-verify-notes-input"
              className="bulk-verify-notes-input"
              value={verificationNotes}
              onChange={e => setVerificationNotes(e.target.value)}
              placeholder="Add notes for the selected recognitions..."
              disabled={processing}
              rows="3"
              aria-describedby="notes-help"
            />
            <p id="notes-help" className="bulk-verify-notes-help">
              Add verification notes or rejection reasons
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bulk-verify-error" role="alert">
            <span className="bulk-verify-error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Success Message */}
        {successCount > 0 && !processing && (
          <div className="bulk-verify-success" role="status">
            <span className="bulk-verify-success-icon">✓</span>
            Successfully verified {successCount} {successCount === 1 ? 'recognition' : 'recognitions'}
          </div>
        )}

        {/* Action Buttons */}
        <div className="bulk-verify-actions">
          <button
            onClick={() => !processing && onClose()}
            className="bulk-verify-btn-cancel"
            disabled={processing}
            aria-label="Cancel bulk verification"
          >
            Cancel
          </button>

          <button
            onClick={() => handleBulkAction('reject')}
            className="bulk-verify-btn-reject"
            disabled={processing || selectedCount === 0}
            aria-label={`Reject ${selectedCount} recognitions`}
          >
            {processing && action === 'reject' ? (
              <>
                <span className="bulk-verify-spinner" />
                Rejecting...
              </>
            ) : (
              `Reject (${selectedCount})`
            )}
          </button>

          <button
            onClick={() => handleBulkAction('approve')}
            className="bulk-verify-btn-approve"
            disabled={processing || selectedCount === 0}
            aria-label={`Approve ${selectedCount} recognitions`}
          >
            {processing && action === 'approve' ? (
              <>
                <span className="bulk-verify-spinner" />
                Approving...
              </>
            ) : (
              `Approve (${selectedCount})`
            )}
          </button>
        </div>

        {/* Stats Footer */}
        <div className="bulk-verify-stats" aria-live="polite" aria-atomic="true">
          <span className="bulk-verify-stat">
            Selected: <strong>{selectedCount}</strong>
          </span>
          <span className="bulk-verify-stat">
            Total Weight: <strong>{
              Array.from(selectedIds)
                .reduce((sum, id) => {
                  const rec = recognitions.find(r => r.$id === id);
                  return sum + (rec?.weight || 0);
                }, 0)
                .toFixed(1)
            }</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default BulkVerificationModal;
