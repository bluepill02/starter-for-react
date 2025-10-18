/**
 * Public Shared Profile Page
 * 
 * Displays a shared recognition profile publicly.
 * URL: /profile/[userId]/shared?token=xxx
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import '../../../../App.css';

export default function SharedProfilePage() {
  const router = useRouter();
  const { userId } = router.query;
  
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recognitions, setRecognitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Extract token from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setToken(searchParams.get('token'));
    }
  }, []);

  useEffect(() => {
    if (!token || !userId) return;
    verifyAndLoadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  async function verifyAndLoadProfile() {
    try {
      // Verify token
      const response = await fetch(
        `/api/functions/verify-profile-share?userId=${userId}&token=${token}`
      );
      const data = await response.json();

      if (!data.valid) {
        setError(data.message || 'This share link has expired or is invalid');
        setLoading(false);
        return;
      }

      setProfile(data.profile);

      // Fetch recognitions
      const recResponse = await fetch(
        `/api/functions/get-public-recognitions?userId=${userId}`
      );
      const recData = await recResponse.json();
      setRecognitions(recData.recognitions || []);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="shared-profile-loader"
      >
        <div className="shared-profile-spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="shared-profile-error">
        <h1>Share Link Error</h1>
        <p>{error}</p>
        <button
          onClick={() => router.push('/')}
          className="shared-profile-btn-primary"
          aria-label="Return to home page"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div role="alert" className="shared-profile-error">
        <h1>Profile Not Found</h1>
        <p>The profile you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <div className="shared-profile-container">
      {/* Header with Profile Info */}
      <header className="shared-profile-header">
        <div className="shared-profile-card">
          {profile.photo && (
            <img
              src={profile.photo}
              alt={profile.name}
              className="shared-profile-photo"
            />
          )}
          <div className="shared-profile-info">
            <h1 className="shared-profile-name">{profile.name}</h1>
            <p className="shared-profile-title">{profile.title}</p>
            {profile.bio && (
              <p className="shared-profile-bio">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div
          className="shared-stats-grid"
          role="region"
          aria-label="Recognition statistics"
        >
          <div className="shared-stat">
            <div className="shared-stat-value">{profile.recognitionCount}</div>
            <div className="shared-stat-label">Recognitions</div>
          </div>
          <div className="shared-stat">
            <div className="shared-stat-value">
              {(profile.totalWeight || 0).toFixed(1)}
            </div>
            <div className="shared-stat-label">Total Weight</div>
          </div>
          <div className="shared-stat">
            <div className="shared-stat-value">{profile.shareViewCount}</div>
            <div className="shared-stat-label">Profile Views</div>
          </div>
        </div>

        {/* Share Buttons */}
        <div
          className="shared-action-buttons"
          role="toolbar"
          aria-label="Share and download options"
        >
          <button
            onClick={() => copyShareLink()}
            className="shared-btn-secondary"
            aria-label="Copy share link to clipboard"
          >
            📋 Copy Link
          </button>
          <button
            onClick={() => downloadProfile()}
            className="shared-btn-secondary"
            aria-label="Download profile as PDF"
          >
            📥 Download PDF
          </button>
          <button
            onClick={() => shareToEmail()}
            className="shared-btn-secondary"
            aria-label="Share via email"
          >
            📧 Email
          </button>
        </div>
      </header>

      {/* Recognitions Gallery */}
      <main className="shared-profile-main">
        <h2 className="shared-section-title">Recognition Gallery</h2>

        {recognitions.length === 0 ? (
          <p className="shared-empty-state">
            No recognitions shared yet. Check back soon!
          </p>
        ) : (
          <div
            className="shared-recognition-grid"
            role="region"
            aria-label="Recognition gallery"
          >
            {recognitions.map((recognition) => (
              <div
                key={recognition.$id}
                className="shared-recognition-card"
                role="article"
              >
                <div className="shared-recognition-header">
                  <h3 className="shared-recognition-title">
                    {recognition.title}
                  </h3>
                  <span
                    className="shared-weight-badge"
                    aria-label={`Weight: ${recognition.weight}`}
                    style={{ backgroundColor: getWeightColor(recognition.weight) }}
                  >
                    {recognition.weight.toFixed(1)}
                  </span>
                </div>

                <p className="shared-recognition-reason">
                  {recognition.reason}
                </p>

                {recognition.tags && recognition.tags.length > 0 && (
                  <div
                    className="shared-tag-container"
                    aria-label="Recognition tags"
                  >
                    {recognition.tags.map((tag) => (
                      <span key={tag} className="shared-tag" role="listitem">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="shared-recognition-meta">
                  By {recognition.giverName || 'Team'}
                  {recognition.verifiedBy && ' • Verified'}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="shared-profile-footer">
        <p className="shared-footer-text">
          © Recognition Platform • 
          <a href="/privacy" className="shared-link"> Privacy</a> • 
          <a href="/terms" className="shared-link"> Terms</a>
        </p>
      </footer>
    </div>
  );
}

// Helper functions
function getWeightColor(weight) {
  if (weight >= 5) return '#10b981'; // emerald
  if (weight >= 3) return '#3b82f6'; // blue
  return '#8b5cf6'; // purple
}

function copyShareLink() {
  if (typeof window === 'undefined') return;
  navigator.clipboard.writeText(window.location.href);
  alert('Share link copied!');
}

function downloadProfile() {
  window.location.href = '/api/functions/export-profile?format=pdf&shared=true';
}

function shareToEmail() {
  const link = typeof window !== 'undefined' ? window.location.href : '';
  window.location.href = `mailto:?subject=Check out my recognition profile&body=I wanted to share my recognition profile with you: ${link}`;
}
