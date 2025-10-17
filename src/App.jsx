import React from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";
import { useRecognitions, useUserRecognitions } from "./hooks/useRecognitions.js";

function Landing() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-background"></div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">🏆</span>
              <span>Trusted by 1000+ teams worldwide</span>
            </div>
            <h1 id="hero-heading" className="hero-title">
              Recognition that
              <span className="gradient-text"> drives results</span>
            </h1>
            <p className="hero-subtitle">
              The only recognition platform that combines evidence-based feedback, 
              manager verification, and enterprise-grade analytics to build high-performing teams.
            </p>
            <div className="hero-cta">
              <Link to="/feed" className="btn-hero-primary">
                <span>Explore Live Feed</span>
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link to="/profile" className="btn-hero-secondary">
                <span>View Profile</span>
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">98%</span>
                <span className="stat-label">Team Satisfaction</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">3x</span>
                <span className="stat-label">Faster Recognition</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">Audit Compliant</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-cards">
              <div className="floating-card card-1">
                <div className="card-header">
                  <div className="user-avatar">JD</div>
                  <div>
                    <div className="user-name">John Doe</div>
                    <div className="user-title">Engineering Lead</div>
                  </div>
                </div>
                <div className="card-content">"Exceptional debugging skills during the critical incident..."</div>
                <div className="card-badge verified">✓ Manager Verified</div>
              </div>
              <div className="floating-card card-2">
                <div className="card-header">
                  <div className="user-avatar">SM</div>
                  <div>
                    <div className="user-name">Sarah Miller</div>
                    <div className="user-title">Product Manager</div>
                  </div>
                </div>
                <div className="card-content">"Outstanding customer advocacy and feature prioritization..."</div>
                <div className="card-tags">
                  <span className="tag">#customer-focus</span>
                  <span className="tag">#leadership</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" aria-labelledby="features-heading">
        <div className="container">
          <div className="section-header">
            <h2 id="features-heading" className="section-title">Why teams choose Recognition</h2>
            <p className="section-subtitle">Built for modern teams that value transparency, growth, and results</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon evidence-icon">📋</div>
              <h3>Evidence-Based Recognition</h3>
              <p>Upload screenshots, documents, or links as evidence. Recognition backed by proof carries 50% more weight.</p>
              <div className="feature-highlight">50% weight bonus</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon verification-icon">✅</div>
              <h3>Manager Verification</h3>
              <p>Built-in approval workflows ensure recognition aligns with company values and performance standards.</p>
              <div className="feature-highlight">Built-in workflows</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon analytics-icon">📊</div>
              <h3>Enterprise Analytics</h3>
              <p>Track team engagement, recognition patterns, and performance metrics with comprehensive dashboards.</p>
              <div className="feature-highlight">Real-time insights</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon privacy-icon">🔒</div>
              <h3>Privacy-First Design</h3>
              <p>GDPR compliant with granular privacy controls. All exports use hashed identifiers to protect employee data.</p>
              <div className="feature-highlight">GDPR compliant</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon integration-icon">🔗</div>
              <h3>Seamless Integrations</h3>
              <p>Works with Slack, Teams, and your existing HR systems. No workflow disruption, just enhanced recognition.</p>
              <div className="feature-highlight">Zero disruption</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon audit-icon">📈</div>
              <h3>Audit-Ready Reports</h3>
              <p>Generate comprehensive reports for performance reviews, compliance audits, and talent development programs.</p>
              <div className="feature-highlight">Compliance ready</div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="social-proof-section">
        <div className="container">
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                "Recognition transformed our team culture. We saw a 40% increase in peer nominations and much more meaningful feedback."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">AC</div>
                <div>
                  <div className="author-name">Alex Chen</div>
                  <div className="author-title">VP of Engineering, TechCorp</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "The evidence-based approach eliminated bias in our recognition program. Now every recognition tells a story."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">MR</div>
                <div>
                  <div className="author-name">Maria Rodriguez</div>
                  <div className="author-title">Chief People Officer, ScaleUp Inc</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
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
            <p className="error-note">Showing sample data below. Please check your Appwrite configuration.</p>
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
  const currentUserId = "demo-user"; // This should come from auth context
  const { recognitions, loading } = useUserRecognitions(currentUserId);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [exportLoading, setExportLoading] = React.useState(false);

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
            <p>Loading your amazing profile...</p>
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
                  Top Recognizer
                </span>
                <span className="profile-badge verified">
                  <svg className="badge-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Leader
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
              Export PDF
            </button>
            <button 
              className="export-btn secondary"
              onClick={() => handleExport('CSV')}
              disabled={exportLoading}
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
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
              <div className="stat-label">Recognitions Received</div>
              <div className="stat-change positive">+12% this month</div>
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
              <div className="stat-label">Recognitions Given</div>
              <div className="stat-change positive">Great job!</div>
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
              <div className="stat-label">Impact Score</div>
              <div className="stat-change positive">Rising ⭐</div>
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
              <div className="stat-label">Verification Rate</div>
              <div className="stat-change positive">Excellent!</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Received ({analytics.totalReceived})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'given' ? 'active' : ''}`}
            onClick={() => setActiveTab('given')}
          >
            Given ({analytics.totalGiven})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="content-grid">
                <div className="overview-section">
                  <h3>Recent Activity</h3>
                  <div className="activity-timeline">
                    <div className="timeline-item">
                      <div className="timeline-dot received"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">Received recognition from John Smith</div>
                        <div className="timeline-subtitle">For exceptional project leadership</div>
                        <div className="timeline-date">2 days ago</div>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="timeline-dot given"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">Recognized Maria Rodriguez</div>
                        <div className="timeline-subtitle">For outstanding customer support</div>
                        <div className="timeline-date">1 week ago</div>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <div className="timeline-dot verified"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">Recognition verified by manager</div>
                        <div className="timeline-subtitle">Impact score increased by 20%</div>
                        <div className="timeline-date">2 weeks ago</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overview-section">
                  <h3>Top Skills</h3>
                  <div className="skills-list">
                    {analytics.topTags.map(({tag, count}, index) => (
                      <div key={tag} className="skill-item">
                        <div className="skill-info">
                          <span className="skill-name">#{tag}</span>
                          <span className="skill-count">{count} mentions</span>
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
                  <h3>Recognition Trends</h3>
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
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                    </div>
                  </div>
                </div>

                <div className="insights-section">
                  <h3>Key Insights</h3>
                  <div className="insight-cards">
                    <div className="insight-card">
                      <div className="insight-icon">📈</div>
                      <div className="insight-text">
                        <div className="insight-title">Growing Recognition</div>
                        <div className="insight-subtitle">You&apos;ve received 40% more recognition this quarter</div>
                      </div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-icon">🎯</div>
                      <div className="insight-text">
                        <div className="insight-title">Leadership Focus</div>
                        <div className="insight-subtitle">Most recognized for leadership and teamwork</div>
                      </div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-icon">⭐</div>
                      <div className="insight-text">
                        <div className="insight-title">High Impact</div>
                        <div className="insight-subtitle">Your recognitions have 2.3x average weight</div>
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
  
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header" role="banner">
        <div className="container">
          <div className="brand">
            <Link to="/" className="logo">Recognition</Link>
            <nav className="site-nav" role="navigation" aria-label="Main navigation">
              <Link to="/feed" className={`nav-link ${location.pathname === '/feed' ? 'active' : ''}`} aria-current={location.pathname === '/feed' ? 'page' : undefined}>Feed</Link>
              <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`} aria-current={location.pathname === '/profile' ? 'page' : undefined}>Profile</Link>
            </nav>
          </div>
        </div>
      </header>

      <div id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>

      <footer className="site-footer" role="contentinfo">
        <div className="container" style={{ padding: "16px" }}>
          <small style={{ color: "#6b7280" }}>© 2025 Recognition — Demo UI with live Appwrite data.</small>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
