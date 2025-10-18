import React from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";
import { useRecognitions, useUserRecognitions } from "./hooks/useRecognitions.js";
import { useI18n, getCurrentLocale, setLocale, getAvailableLocales } from "../apps/web/src/lib/i18n.ts";
import Leaderboard from "../apps/web/src/pages/leaderboard.tsx";
import Analytics from "../apps/web/src/pages/analytics.tsx";
import { SignInPage } from "../apps/web/src/pages/sign-in.tsx";
import DomainsPage from "../apps/web/src/pages/admin/domains.tsx";
import AuditLogExportPage from "../apps/web/src/pages/admin/audit-log-export.tsx";
import CompliancePolicyPage from "../apps/web/src/pages/admin/compliance-policy.tsx";
import SystemHealthPage from "../apps/web/src/pages/system-health.tsx";
import QuotaManagementPage from "../apps/web/src/pages/admin/quota-management.tsx";
import MonitoringDashboard from "../apps/web/src/pages/admin/monitoring.tsx";
import IncidentResponse from "../apps/web/src/pages/admin/incident-response.tsx";
import AdminDashboard from "../apps/web/src/pages/admin/index.tsx";
import AdminVerifyPage from "../apps/web/src/pages/admin/verify.tsx";
import AdminAnalyticsPage from "../apps/web/src/pages/admin/analytics.tsx";
import AdminGrowthPage from "../apps/web/src/pages/admin/growth.tsx";
import AdminAbusePage from "../apps/web/src/pages/admin/abuse.tsx";
import OnboardingOverlay from "../apps/web/src/components/OnboardingOverlay.tsx";
import { useAuth } from "../apps/web/src/lib/auth";
import { getOnboardingState, isCompleted } from "../apps/web/src/lib/onboarding";
import { OAuthCallbackPage } from "../apps/web/src/pages/auth/callback.tsx";
import SettingsPage from "../apps/web/src/pages/settings/index.tsx";
import IntegrationsPage from "../apps/web/src/pages/integrations/index.tsx";
import MicroInteractionsDemo from "../apps/web/src/pages/demo/micro-interactions.tsx";
import { ToastProvider } from "../apps/web/src/hooks/useToast.tsx";
import { ToastContainer } from "../apps/web/src/components/ToastContainer.tsx";
// i18n header controls are imported above

function Landing() {
  const [demoOpen, setDemoOpen] = React.useState(false);
  const demoTitleId = "demo-modal-title";
  const demoRef = React.useRef(null);
  const locale = getCurrentLocale();

  // Landing i18n strings
  const badgeText = useI18n('landing.badge');
  const heroTitleHtml = useI18n(locale === 'ta' ? 'landing.hero_title_ta' : 'landing.hero_title');
  const heroSubtitle = useI18n('landing.hero_subtitle');
  const ctaPrimary = useI18n('landing.cta_primary');
  const ctaDemo = useI18n('landing.cta_demo');
  const statSatisfaction = useI18n('landing.stat_satisfaction');
  const statFaster = useI18n('landing.stat_faster');
  const statCompliant = useI18n('landing.stat_compliant');
  const featuresTitle = useI18n('landing.features_title');
  const featuresSubtitle = useI18n('landing.features_subtitle');
  const featEvTitle = useI18n('landing.feature_evidence_title');
  const featEvDesc = useI18n('landing.feature_evidence_desc');
  const featEvBadge = useI18n('landing.feature_evidence_badge');
  const featVerTitle = useI18n('landing.feature_verification_title');
  const featVerDesc = useI18n('landing.feature_verification_desc');
  const featVerBadge = useI18n('landing.feature_verification_badge');
  const featAnTitle = useI18n('landing.feature_analytics_title');
  const featAnDesc = useI18n('landing.feature_analytics_desc');
  const featAnBadge = useI18n('landing.feature_analytics_badge');
  const featPrTitle = useI18n('landing.feature_privacy_title');
  const featPrDesc = useI18n('landing.feature_privacy_desc');
  const featPrBadge = useI18n('landing.feature_privacy_badge');
  const featAuTitle = useI18n('landing.feature_audit_title');
  const featAuDesc = useI18n('landing.feature_audit_desc');
  const featAuBadge = useI18n('landing.feature_audit_badge');
  const trustAudit = useI18n('landing.trust_audit_ready');
  const trustVerified = useI18n('landing.trust_manager_verified');
  const trustPrivate = useI18n('landing.trust_private_by_default');
  const ariaSsoGoogle = useI18n('landing.sso_google');
  const ariaSsoMicrosoft = useI18n('landing.sso_microsoft');
  const testimonial1 = useI18n('landing.testimonial_1');
  const testimonial1Author = useI18n('landing.testimonial_1_author');
  const testimonial1Title = useI18n('landing.testimonial_1_title');
  const testimonial2 = useI18n('landing.testimonial_2');
  const testimonial2Author = useI18n('landing.testimonial_2_author');
  const testimonial2Title = useI18n('landing.testimonial_2_title');
  const demoTitle = useI18n('landing.demo_title');
  const demoRecipient = useI18n('landing.demo_recipient');
  const demoTags = useI18n('landing.demo_tags');
  const demoReason = useI18n('landing.demo_reason');
  const demoReasonPh = useI18n('landing.demo_reason_placeholder');
  const demoSend = useI18n('landing.demo_send');
  const ariaClose = useI18n('landing.aria_close');

  React.useEffect(() => {
    if (demoOpen && demoRef.current) {
      const firstInput = demoRef.current.querySelector('.demo-input');
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [demoOpen]);

  const onDemoKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setDemoOpen(false);
      return;
    }
    if (e.key === 'Tab' && demoRef.current) {
      const focusables = demoRef.current.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-background"></div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">🔒</span>
              <span>{badgeText}</span>
            </div>
            <h1
              id="hero-heading"
              className="hero-title"
              lang={locale === 'ta' ? 'ta' : undefined}
              dangerouslySetInnerHTML={{ __html: heroTitleHtml }}
            />
            <p className="hero-subtitle">{heroSubtitle}</p>
            <div className="hero-cta">
              <Link to="/sign-in" className="btn-hero-primary cta-animate" aria-label={ctaPrimary}>
                <span>{ctaPrimary}</span>
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <button type="button" className="btn-hero-secondary-link" onClick={() => setDemoOpen(true)}>
                {ctaDemo}
              </button>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">🔒</span>
                <span className="stat-label">{statSatisfaction}</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">📋</span>
                <span className="stat-label">{statFaster}</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">✓</span>
                <span className="stat-label">{statCompliant}</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="subtle-illustration" aria-hidden="true">
              <svg viewBox="0 0 400 400" className="blob-illustration">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#e0f2fe', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#e9d5ff', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <path fill="url(#grad)" d="M319,263Q287,326,214,338Q141,350,105,295Q69,240,79,171Q89,102,158,79Q227,56,287,99Q347,142,346,206Q345,270,319,263Z"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" aria-labelledby="features-heading">
        <div className="container">
          <div className="section-header">
            <h2 id="features-heading" className="section-title">{featuresTitle}</h2>
            <p className="section-subtitle">{featuresSubtitle}</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon evidence-icon">📋</div>
              <h3>{featEvTitle}</h3>
              <p>{featEvDesc}</p>
              <div className="feature-highlight">{featEvBadge}</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon verification-icon">✅</div>
              <h3>{featVerTitle}</h3>
              <p>{featVerDesc}</p>
              <div className="feature-highlight">{featVerBadge}</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon analytics-icon">📊</div>
              <h3>{featAnTitle}</h3>
              <p>{featAnDesc}</p>
              <div className="feature-highlight">{featAnBadge}</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon privacy-icon">🔒</div>
              <h3>{featPrTitle}</h3>
              <p>{featPrDesc}</p>
              <div className="feature-highlight">{featPrBadge}</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon integration-icon">🔗</div>
              <h3>{featAuTitle}</h3>
              <p>{featAuDesc}</p>
              <div className="feature-highlight">{featAuBadge}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="trust-strip" aria-label="Trust signals">
        <div className="container trust-content">
          <div className="sso-badges" aria-label="Single sign-on providers">
            <span className="sso-badge" aria-label={ariaSsoGoogle}>G</span>
            <span className="sso-badge" aria-label={ariaSsoMicrosoft}>MS</span>
          </div>
          <ul className="trust-bullets">
            <li>{trustAudit}</li>
            <li>{trustVerified}</li>
            <li>{trustPrivate}</li>
          </ul>
          <div className="customers-row" aria-label="Platform highlights">
            <div className="feature-highlight">SSO Ready</div>
            <div className="feature-highlight">GDPR Compliant</div>
            <div className="feature-highlight">Audit Trails</div>
            <div className="feature-highlight">Tamil Support</div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="social-proof-section">
        <div className="container">
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                {testimonial1}
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">RP</div>
                <div>
                  <div className="author-name">{testimonial1Author}</div>
                  <div className="author-title">{testimonial1Title}</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                {testimonial2}
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">RP</div>
                <div>
                  <div className="author-name">{testimonial2Author}</div>
                  <div className="author-title">{testimonial2Title}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Modal */}
      {demoOpen && (
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby={demoTitleId} onKeyDown={onDemoKeyDown}>
          <div className="demo-overlay" onClick={() => setDemoOpen(false)} aria-hidden="true" />
          <div className="demo-content" ref={demoRef}>
            <div className="demo-header">
              <h2 id={demoTitleId}>{demoTitle}</h2>
              <button className="demo-close" aria-label={ariaClose} onClick={() => setDemoOpen(false)}>✕</button>
            </div>
            <form className="demo-form" onSubmit={(e) => { e.preventDefault(); setDemoOpen(false); }}>
              <label className="demo-label">
                {demoRecipient}
                <input className="demo-input" type="text" placeholder="e.g., Priya Narayanan" required />
              </label>
              <label className="demo-label">
                {demoTags}
                <input className="demo-input" type="text" placeholder="e.g., #teamwork, #delivery" />
              </label>
              <label className="demo-label">
                {demoReason}
                <textarea className="demo-textarea" rows={3} placeholder={demoReasonPh} required />
              </label>
              <button className="btn-hero-primary cta-animate" type="submit">{demoSend}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Feed() {
  const { recognitions, loading, error } = useRecognitions();
  const [filter, setFilter] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState('newest');

  // Filter and sort recognitions
  const filteredRecognitions = React.useMemo(() => {
    let filtered = [...recognitions];

    // Apply filter
    if (filter === 'verified') {
      filtered = filtered.filter(r => r.isVerified);
    } else if (filter === 'unverified') {
      filtered = filtered.filter(r => !r.isVerified);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.giverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'weight':
          return b.weight - a.weight;
        default:
          return 0;
      }
    });

    return filtered;
  }, [recognitions, filter, searchTerm, sortBy]);

  if (loading) {
    return (
      <main className="feed-page" aria-labelledby="feed-heading">
        <div className="container">
          <div className="feed-header">
            <h1 id="feed-heading" className="page-title">Recognition Feed</h1>
            <p className="page-subtitle">Celebrating achievements across our team</p>
          </div>
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading amazing recognitions...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="feed-page" aria-labelledby="feed-heading">
        <div className="container">
          <div className="feed-header">
            <h1 id="feed-heading" className="page-title">Recognition Feed</h1>
            <p className="page-subtitle">Celebrating achievements across our team</p>
          </div>
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h3>Unable to load recognitions</h3>
            <p>{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="feed-page" aria-labelledby="feed-heading">
      <div className="container">
        <div className="feed-header">
          <div className="header-content">
            <h1 id="feed-heading" className="page-title">Recognition Feed</h1>
            <p className="page-subtitle">
              {recognitions.length} recognitions • {recognitions.filter(r => r.isVerified).length} verified
            </p>
          </div>
          <div className="feed-actions">
            <button className="btn-primary create-recognition">
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Give Recognition
            </button>
          </div>
        </div>

        <div className="feed-controls">
          <div className="search-bar">
            <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search recognitions, people, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="filter-controls">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Recognition</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Pending Verification</option>
            </select>

            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="weight">Highest Weight</option>
            </select>
          </div>
        </div>

        {filteredRecognitions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3>No recognitions found</h3>
            <p>
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Be the first to recognize someone amazing!'
              }
            </p>
            {!searchTerm && filter === 'all' && (
              <button className="btn-primary">Give Recognition</button>
            )}
          </div>
        ) : (
          <div className="feed-content">
            <div className="recognition-grid">
              {filteredRecognitions.map((r, index) => (
                <article key={r.id} className={`recognition-card ${r.isVerified ? 'verified' : 'pending'}`} style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="card-header">
                    <div className="user-info">
                      <div className="avatar-group">
                        <div className="user-avatar giver-avatar" title={r.giverName}>
                          {r.giverName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="arrow-connector">→</div>
                        <div className="user-avatar recipient-avatar" title={r.recipientName}>
                          {r.recipientName.split(' ').map(n => n[0]).join('')}
                        </div>
                      </div>
                      <div className="user-names">
                        <span className="giver-name">{r.giverName}</span>
                        <span className="recognition-to">recognized</span>
                        <span className="recipient-name">{r.recipientName}</span>
                      </div>
                    </div>
                    <div className="card-badges">
                      {r.isVerified && (
                        <span className="verification-badge verified">
                          <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      <span className={`weight-badge weight-${Math.floor(r.weight)}`}>
                        {r.weight}x impact
                      </span>
                    </div>
                  </div>

                  <div className="card-content">
                    <p className="recognition-text">{r.reason}</p>
                    
                    {r.tags && r.tags.length > 0 && (
                      <div className="tag-list">
                        {r.tags.map((tag, tagIndex) => (
                          <span key={tagIndex} className="recognition-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {r.evidencePreviewUrl && (
                      <div className="evidence-preview">
                        <svg className="evidence-icon" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        Evidence attached
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <div className="meta-info">
                      <time className="recognition-date" dateTime={r.createdAt}>
                        {new Date(r.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: new Date(r.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })}
                      </time>
                      <span className="visibility-indicator">{r.visibility.toLowerCase()}</span>
                    </div>
                    
                    <div className="card-actions">
                      <button className="action-btn" aria-label="Like recognition">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button className="action-btn" aria-label="Share recognition">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        </svg>
                      </button>
                    </div>

                    {r.isVerified && r.verifierName && (
                      <div className="verification-info">
                        Verified by {r.verifierName}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Profile() {
  const { useAuth } = React;
  const auth = useAuth?.() || null;
  const currentUserId = auth?.$id || "anonymous";
  const { recognitions, loading } = useUserRecognitions(currentUserId);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [exportLoading, setExportLoading] = React.useState(false);

  // i18n hooks for translations
  const loadingMessage = useI18n('profile.loadingMessage');
  const topRecognizerBadge = useI18n('profile.badges.topRecognizer');
  const verifiedLeaderBadge = useI18n('profile.badges.verifiedLeader');
  const exportPDFText = useI18n('profile.exportPDF');
  const exportCSVText = useI18n('profile.exportCSV');
  const recognitionsReceivedText = useI18n('profile.stats.recognitionsReceived');
  const recognitionsGivenText = useI18n('profile.stats.recognitionsGiven');
  const impactScoreText = useI18n('profile.impactScore');
  const verificationRateText = useI18n('profile.verificationRate');
  const changePositiveText = useI18n('profile.stats.changePositive');
  const greatJobText = useI18n('profile.stats.greatJob');
  const excellentText = useI18n('profile.stats.excellent');
  const risingText = useI18n('profile.stats.rising');
  const overviewTabText = useI18n('profile.tabs.overview');
  const receivedTabText = useI18n('profile.tabs.received');
  const givenTabText = useI18n('profile.tabs.given');
  const analyticsTabText = useI18n('profile.tabs.analytics');
  const recentActivityText = useI18n('profile.sections.recentActivity');
  const topSkillsText = useI18n('profile.sections.topSkills');
  const recognitionTrendsText = useI18n('profile.sections.recognitionTrends');
  const keyInsightsText = useI18n('profile.sections.keyInsights');
  const mentionsText = useI18n('profile.skills.mentions');
  const growingRecognitionText = useI18n('profile.insights.growingRecognition');
  const growingDescText = useI18n('profile.insights.growingDesc');
  const leadershipFocusText = useI18n('profile.insights.leadershipFocus');
  const leadershipDescText = useI18n('profile.insights.leadershipDesc');
  const highImpactText = useI18n('profile.insights.highImpact');
  const highImpactDescText = useI18n('profile.insights.highImpactDesc');
  // Activity translations
  const receivedFromText = useI18n('profile.activity.receivedFrom', { name: 'John Smith' });
  const recognizedText = useI18n('profile.activity.recognized', { name: 'Maria Rodriguez' });
  const verifiedText = useI18n('profile.activity.verified');
  const forLeadershipText = useI18n('profile.activity.forLeadership');
  const forSupportText = useI18n('profile.activity.forSupport');
  const impactIncreasedText = useI18n('profile.activity.impactIncreased');
  const twoDaysAgoText = useI18n('profile.activity.daysAgo', { days: '2' });
  const oneWeekAgoText = useI18n('profile.activity.weekAgo');
  const twoWeeksAgoText = useI18n('profile.activity.weeksAgo', { weeks: '2' });
  // Chart month labels
  const janText = useI18n('profile.chart.jan');
  const febText = useI18n('profile.chart.feb');
  const marText = useI18n('profile.chart.mar');
  const aprText = useI18n('profile.chart.apr');
  const mayText = useI18n('profile.chart.may');
  const junText = useI18n('profile.chart.jun');

  // Mock user data - in real app this would come from auth context
  const user = {
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    role: "Senior Product Manager",
    department: "Product",
    joinDate: "2023-01-15",
    avatar: "SJ"
  };

  // Calculate analytics from recognition data
  const analytics = React.useMemo(() => {
    if (!recognitions || loading) {
      return {
        totalGiven: 0,
        totalReceived: 0,
        verificationRate: 0,
        avgWeight: 0,
        topTags: [],
        monthlyTrend: [],
        impactScore: 0
      };
    }

    const given = recognitions.given || [];
    const received = recognitions.received || [];
    
    const totalWeight = received.reduce((sum, r) => sum + (r.weight || 1), 0);
    const verifiedCount = received.filter(r => r.verified).length;
    
    // Calculate top tags
    const tagCounts = {};
    [...given, ...received].forEach(r => {
      (r.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalGiven: given.length,
      totalReceived: received.length,
      verificationRate: received.length > 0 ? (verifiedCount / received.length) * 100 : 0,
      avgWeight: received.length > 0 ? totalWeight / received.length : 0,
      topTags,
      impactScore: Math.min(100, totalWeight * 10 + given.length * 5)
    };
  }, [recognitions, loading]);

  const handleExport = async (format) => {
    setExportLoading(true);
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    setExportLoading(false);
    // In real app, trigger actual export
    alert(`${format} export ready for download!`);
  };

  if (loading) {
    return (
      <main className="profile-page">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>{loadingMessage}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page" aria-labelledby="profile-heading">
      <div className="container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-info">
            <div className="profile-avatar-large">
              {user.avatar}
              <div className="avatar-status online"></div>
            </div>
            <div className="profile-details">
              <h1 id="profile-heading" className="profile-name">{user.name}</h1>
              <p className="profile-role">{user.role} • {user.department}</p>
              <p className="profile-email">{user.email}</p>
              <div className="profile-badges">
                <span className="profile-badge">
                  <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {topRecognizerBadge}
                </span>
                <span className="profile-badge verified">
                  <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {verifiedLeaderBadge}
                </span>
              </div>
            </div>
          </div>
          
          <div className="profile-actions">
            <button 
              className={`export-btn ${exportLoading ? 'loading' : ''}`}
              onClick={() => handleExport('PDF')}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <div className="btn-spinner"></div>
              ) : (
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4m-4 4V8a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V8z" />
                </svg>
              )}
              {exportPDFText}
            </button>
            <button 
              className="export-btn secondary"
              onClick={() => handleExport('CSV')}
              disabled={exportLoading}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportCSVText}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{analytics.totalReceived}</div>
              <div className="stat-label">{recognitionsReceivedText}</div>
              <div className="stat-change positive">{changePositiveText}</div>
            </div>
          </div>

          <div className="stat-card secondary">
            <div className="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{analytics.totalGiven}</div>
              <div className="stat-label">{recognitionsGivenText}</div>
              <div className="stat-change positive">{greatJobText}</div>
            </div>
          </div>

          <div className="stat-card accent">
            <div className="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{analytics.impactScore}</div>
              <div className="stat-label">{impactScoreText}</div>
              <div className="stat-change positive">{risingText}</div>
            </div>
          </div>

          <div className="stat-card highlight">
            <div className="stat-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{analytics.verificationRate.toFixed(0)}%</div>
              <div className="stat-label">{verificationRateText}</div>
              <div className="stat-change positive">{excellentText}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            {overviewTabText}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            {receivedTabText} ({analytics.totalReceived})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'given' ? 'active' : ''}`}
            onClick={() => setActiveTab('given')}
          >
            {givenTabText} ({analytics.totalGiven})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            {analyticsTabText}
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="content-grid">
                <div className="overview-section">
                  <h3>{recentActivityText}</h3>
                  <div className="activity-timeline">
                    <div className="timeline-item">
                      <div className="timeline-dot received"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">{receivedFromText}</div>
                        <div className="timeline-subtitle">{forLeadershipText}</div>
                        <div className="timeline-date">{twoDaysAgoText}</div>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="timeline-dot given"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">{recognizedText}</div>
                        <div className="timeline-subtitle">{forSupportText}</div>
                        <div className="timeline-date">{oneWeekAgoText}</div>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="timeline-dot verified"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">{verifiedText}</div>
                        <div className="timeline-subtitle">{impactIncreasedText}</div>
                        <div className="timeline-date">{twoWeeksAgoText}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overview-section">
                  <h3>{topSkillsText}</h3>
                  <div className="skills-list">
                    {analytics.topTags.map(({tag, count}, index) => (
                      <div key={tag} className="skill-item">
                        <div className="skill-info">
                          <span className="skill-name">#{tag}</span>
                          <span className="skill-count">{count} {mentionsText.replace('{{count}}', '')}</span>
                        </div>
                        <div className="skill-bar">
                          <div 
                            className="skill-progress" 
                            style={{ 
                              width: `${(count / Math.max(...analytics.topTags.map(t => t.count))) * 100}%`,
                              animationDelay: `${index * 0.1}s`
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="analytics-content">
              <div className="analytics-grid">
                <div className="chart-section">
                  <h3>{recognitionTrendsText}</h3>
                  <div className="chart-placeholder">
                    <div className="chart-bars">
                      <div className="chart-bar" style={{ height: '60%', animationDelay: '0s' }}></div>
                      <div className="chart-bar" style={{ height: '80%', animationDelay: '0.1s' }}></div>
                      <div className="chart-bar" style={{ height: '45%', animationDelay: '0.2s' }}></div>
                      <div className="chart-bar" style={{ height: '90%', animationDelay: '0.3s' }}></div>
                      <div className="chart-bar" style={{ height: '70%', animationDelay: '0.4s' }}></div>
                      <div className="chart-bar" style={{ height: '95%', animationDelay: '0.5s' }}></div>
                    </div>
                    <div className="chart-labels">
                      <span>{janText}</span><span>{febText}</span><span>{marText}</span><span>{aprText}</span><span>{mayText}</span><span>{junText}</span>
                    </div>
                  </div>
                </div>

                <div className="insights-section">
                  <h3>{keyInsightsText}</h3>
                  <div className="insight-cards">
                    <div className="insight-card">
                      <div className="insight-icon">📈</div>
                      <div className="insight-text">
                        <div className="insight-title">{growingRecognitionText}</div>
                        <div className="insight-subtitle">{growingDescText}</div>
                      </div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-icon">🎯</div>
                      <div className="insight-text">
                        <div className="insight-title">{leadershipFocusText}</div>
                        <div className="insight-subtitle">{leadershipDescText}</div>
                      </div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-icon">⭐</div>
                      <div className="insight-text">
                        <div className="insight-title">{highImpactText}</div>
                        <div className="insight-subtitle">{highImpactDescText}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function AppShell() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [lang, setLang] = React.useState(getCurrentLocale());
  const navFeed = useI18n('nav.feed');
  const navLeaderboard = useI18n('nav.leaderboard');
  const navAnalytics = useI18n('nav.analytics');
  const navProfile = useI18n('nav.profile');
  const navAdmin = useI18n('nav.admin');
  const navDomains = useI18n('nav.domains');
  const navAuditLogs = useI18n('nav.audit_logs');
  const navCompliance = useI18n('nav.compliance');
  const navLanguage = useI18n('nav.language');
  const navSkip = useI18n('nav.skip_to_content');

  React.useEffect(() => {
  const handler = () => setLang(getCurrentLocale());
    window.addEventListener('locale-change', handler);
    return () => window.removeEventListener('locale-change', handler);
  }, []);

  React.useEffect(() => {
    (async () => {
      if (currentUser && location.pathname === '/feed') {
        const state = await getOnboardingState();
        setShowOnboarding(!isCompleted(state) && !state.skipped);
      } else {
        setShowOnboarding(false);
      }
    })();
  }, [currentUser, location.pathname]);

  const onLangChange = (e) => {
    const newLocale = e.target.value;
    setLocale(newLocale);
    // setLocale dispatches 'locale-change' and persists to localStorage internally
  };
  
  return (
    <div className="app-shell">
  <a href="#main" className="skip-link">{navSkip}</a>
      <header className="site-header" role="banner">
        <div className="container">
          <div className="brand">
            <Link to="/" className="logo">Recognition</Link>
            <nav className="site-nav" role="navigation" aria-label="Main navigation">
              <Link to="/feed" className={`nav-link ${location.pathname === '/feed' ? 'active' : ''}`} aria-current={location.pathname === '/feed' ? 'page' : undefined}>{navFeed}</Link>
              <Link to="/leaderboard" className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`} aria-current={location.pathname === '/leaderboard' ? 'page' : undefined}>{navLeaderboard}</Link>
              <Link to="/analytics" className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`} aria-current={location.pathname === '/analytics' ? 'page' : undefined}>{navAnalytics}</Link>
              <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`} aria-current={location.pathname === '/profile' ? 'page' : undefined}>{navProfile}</Link>
              <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`} aria-current={location.pathname === '/settings' ? 'page' : undefined}>{useI18n('nav.settings')}</Link>
              <Link to="/integrations" className={`nav-link ${location.pathname === '/integrations' ? 'active' : ''}`} aria-current={location.pathname === '/integrations' ? 'page' : undefined}>{useI18n('nav.integrations')}</Link>
              {currentUser && currentUser.role === 'ADMIN' && (
                <details className="admin-menu">
                  <summary className="nav-link">{navAdmin} ⚙️</summary>
                  <div className="admin-submenu">
                    <Link to="/admin" className="submenu-link">Dashboard</Link>
                    <Link to="/admin/verify" className="submenu-link">Verify</Link>
                    <Link to="/admin/abuse" className="submenu-link">Abuse</Link>
                    <Link to="/admin/analytics" className="submenu-link">Analytics</Link>
                    <Link to="/admin/growth" className="submenu-link">Growth</Link>
                    <hr className="submenu-divider" />
                    <Link to="/admin/domains" className="submenu-link">{navDomains}</Link>
                    <Link to="/admin/audit-logs" className="submenu-link">{navAuditLogs}</Link>
                    <Link to="/admin/compliance-policies" className="submenu-link">{navCompliance}</Link>
                    <Link to="/admin/system-health" className="submenu-link">System Health</Link>
                    <Link to="/admin/quotas" className="submenu-link">Quotas</Link>
                    <Link to="/admin/monitoring" className="submenu-link">Monitoring</Link>
                    <Link to="/admin/incidents" className="submenu-link">Incidents</Link>
                  </div>
                </details>
              )}
              <label htmlFor="lang" className="sr-only">{navLanguage}</label>
              <select id="lang" className="nav-link lang-select" aria-label={navLanguage} value={lang} onChange={onLangChange}>
                {getAvailableLocales().map((loc) => (
                  <option key={loc} value={loc}>
                    {loc === 'en' ? 'English' : loc === 'ta' ? 'தமிழ்' : loc}
                  </option>
                ))}
              </select>
            </nav>
          </div>
        </div>
      </header>

      <div id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/demo/micro-interactions" element={<MicroInteractionsDemo />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/admin/domains" element={<DomainsPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogExportPage />} />
          <Route path="/admin/compliance-policies" element={<CompliancePolicyPage />} />
          <Route path="/admin/system-health" element={<SystemHealthPage />} />
          <Route path="/admin/quotas" element={<QuotaManagementPage />} />
          <Route path="/admin/monitoring" element={<MonitoringDashboard />} />
          <Route path="/admin/incidents" element={<IncidentResponse />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/verify" element={<AdminVerifyPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/growth" element={<AdminGrowthPage />} />
          <Route path="/admin/abuse" element={<AdminAbusePage />} />
        </Routes>
        {showOnboarding && (
          <OnboardingOverlay open={showOnboarding} onClose={() => setShowOnboarding(false)} />)
        }
      </div>

      <footer className="site-footer" role="contentinfo">
        <div className="container" style={{ padding: "16px", display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <small style={{ color: "#6b7280" }}>© 2025 Recognition App</small>
          <nav aria-label="Legal" className="legal-links">
            <a href="#" className="legal-link">Terms</a>
            <a href="#" className="legal-link">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
        <ToastContainer />
      </ToastProvider>
    </BrowserRouter>
  );
}
