/**
 * Public Shared Profile Page
 * 
 * Displays a shared recognition profile publicly.
 * URL: /profile/[userId]/shared?token=xxx
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface Profile {
  userId: string;
  name: string;
  title: string;
  photo: string | null;
  bio: string | null;
  recognitionCount: number;
  totalWeight: number;
  joinedAt: string;
  shareViewCount: number;
}

interface Recognition {
  $id: string;
  title: string;
  reason: string;
  weight: number;
  tags: string[];
  giverName: string;
  verifiedBy?: boolean;
}

export default function SharedProfilePage() {
  const router = useRouter();
  const { userId } = router.query;
  const [token, setToken] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract token from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setToken(searchParams.get('token'));
    }
  }, []);

  useEffect(() => {
    verifyAndLoadProfile();
  }, [userId, token]);

  async function verifyAndLoadProfile() {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

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

      // Fetch recognitions (fetch public recognitions for this user)
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
      <div
        role="alert"
        className="shared-profile-error"
      >
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

  return (
    <div className="shared-profile-container">
      {/* Header with Profile Info */}
      <header style={styles.header}>
        <div style={styles.profileCard}>
          {profile.photo && (
            <img
              src={profile.photo}
              alt={profile.name}
              style={styles.profilePhoto}
            />
          )}
          <div style={styles.profileInfo}>
            <h1 style={styles.profileName}>{profile.name}</h1>
            <p style={styles.profileTitle}>{profile.title}</p>
            {profile.bio && (
              <p style={styles.profileBio}>{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid} role="region" aria-label="Recognition statistics">
          <div style={styles.stat}>
            <div style={styles.statValue}>{profile.recognitionCount}</div>
            <div style={styles.statLabel}>Recognitions</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{(profile.totalWeight || 0).toFixed(1)}</div>
            <div style={styles.statLabel}>Total Weight</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{profile.shareViewCount}</div>
            <div style={styles.statLabel}>Profile Views</div>
          </div>
        </div>

        {/* Share Buttons */}
        <div style={styles.actionButtons} role="toolbar" aria-label="Share and download options">
          <button
            onClick={() => copyShareLink()}
            style={styles.buttonSecondary}
            aria-label="Copy share link to clipboard"
          >
            📋 Copy Link
          </button>
          <button
            onClick={() => downloadProfile()}
            style={styles.buttonSecondary}
            aria-label="Download profile as PDF"
          >
            📥 Download PDF
          </button>
          <button
            onClick={() => shareToEmail()}
            style={styles.buttonSecondary}
            aria-label="Share via email"
          >
            📧 Email
          </button>
        </div>
      </header>

      {/* Recognitions Gallery */}
      <main style={styles.main}>
        <h2 style={styles.sectionTitle}>Recognition Gallery</h2>

        {recognitions.length === 0 ? (
          <p style={styles.emptyState}>
            No recognitions shared yet. Check back soon!
          </p>
        ) : (
          <div
            style={styles.recognitionGrid}
            role="region"
            aria-label="Recognition gallery"
          >
            {recognitions.map((recognition) => (
              <div
                key={recognition.$id}
                style={styles.recognitionCard}
                role="article"
              >
                <div style={styles.recognitionHeader}>
                  <h3 style={styles.recognitionTitle}>
                    {recognition.title}
                  </h3>
                  <span
                    style={{
                      ...styles.weightBadge,
                      backgroundColor: getWeightColor(recognition.weight)
                    }}
                    aria-label={`Weight: ${recognition.weight}`}
                  >
                    {recognition.weight.toFixed(1)}
                  </span>
                </div>

                <p style={styles.recognitionReason}>
                  {recognition.reason}
                </p>

                {recognition.tags && recognition.tags.length > 0 && (
                  <div style={styles.tagContainer} aria-label="Recognition tags">
                    {recognition.tags.map((tag) => (
                      <span
                        key={tag}
                        style={styles.tag}
                        role="listitem"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <p style={styles.recognitionMeta}>
                  By {recognition.giverName || 'Team'}
                  {recognition.verifiedBy && ' • Verified'}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          © Recognition Platform • 
          <a href="/privacy" style={styles.link}> Privacy</a> • 
          <a href="/terms" style={styles.link}> Terms</a>
        </p>
      </footer>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .shared-profile-container {
            background-color: #1a1a1a;
            color: #e0e0e0;
          }
        }

        @media print {
          .shared-profile-container {
            background: white;
            color: black;
          }
        }
      `}</style>
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
  // Trigger PDF generation via API
  window.location.href = `/api/functions/export-profile?format=pdf&shared=true`;
}

function shareToEmail() {
  const link = typeof window !== 'undefined' ? window.location.href : '';
  window.location.href = `mailto:?subject=Check out my recognition profile&body=I wanted to share my recognition profile with you: ${link}`;
}

// Inline styles (to match component pattern used in project)
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    padding: '2rem 1rem'
  },
  loader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem'
  },
  spinner: {
    width: '3rem',
    height: '3rem',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite'
  },
  error: {
    maxWidth: '500px',
    margin: '4rem auto',
    padding: '2rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '0.5rem',
    textAlign: 'center'
  },
  header: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  profileCard: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '2rem',
    alignItems: 'flex-start'
  },
  profilePhoto: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #3b82f6'
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.875rem',
    fontWeight: 'bold'
  },
  profileTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1rem',
    color: '#6b7280'
  },
  profileBio: {
    margin: '0',
    fontSize: '0.9rem',
    color: '#4b5563'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem'
  },
  stat: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '0.5rem'
  },
  statValue: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    color: '#3b82f6'
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem'
  },
  actionButtons: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  button: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  buttonSecondary: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#e5e7eb',
    color: '#1f2937',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    marginTop: 0
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#6b7280'
  },
  recognitionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem'
  },
  recognitionCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  recognitionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem'
  },
  recognitionTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: '600',
    flex: 1
  },
  weightBadge: {
    padding: '0.25rem 0.75rem',
    color: 'white',
    fontSize: '0.875rem',
    borderRadius: '9999px',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  recognitionReason: {
    margin: '0 0 1rem 0',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    color: '#374151'
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  tag: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#f3f4f6',
    color: '#3b82f6',
    fontSize: '0.8rem',
    borderRadius: '0.25rem',
    border: '1px solid #d1d5db'
  },
  recognitionMeta: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#6b7280'
  },
  footer: {
    marginTop: '3rem',
    paddingTop: '2rem',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center'
  },
  footerText: {
    color: '#6b7280',
    fontSize: '0.875rem',
    margin: 0
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none'
  }
};
