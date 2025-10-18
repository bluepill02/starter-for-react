import React, { useState } from 'react';
import { useI18n } from '../lib/i18n';

interface RecognitionTemplate {
  id: string;
  icon: string;
  titleKey: string;
  bodyKey: string;
  suggestedTags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface RecognitionTemplatesProps {
  onSelectTemplate: (template: RecognitionTemplate) => void;
}

/**
 * RecognitionTemplates Component
 * 
 * Helps new users create their first recognition by providing pre-filled templates.
 * Templates include:
 * - Teamwork
 * - Leadership
 * - Innovation
 * - Communication
 * - Reliability
 * - Support
 * 
 * WCAG 2.1 AA Compliant:
 * - Semantic HTML structure
 * - ARIA labels on buttons
 * - Keyboard navigation
 * - Focus management
 */
const TEMPLATES: RecognitionTemplate[] = [
  {
    id: 'teamwork',
    icon: '👥',
    titleKey: 'templates.teamwork',
    bodyKey: 'templates.teamworkBody',
    suggestedTags: ['teamwork', 'collaboration', 'project'],
    difficulty: 'beginner'
  },
  {
    id: 'leadership',
    icon: '⭐',
    titleKey: 'templates.leadership',
    bodyKey: 'templates.leadershipBody',
    suggestedTags: ['leadership', 'mentor', 'initiative'],
    difficulty: 'intermediate'
  },
  {
    id: 'innovation',
    icon: '💡',
    titleKey: 'templates.innovation',
    bodyKey: 'templates.innovationBody',
    suggestedTags: ['innovation', 'creative', 'process'],
    difficulty: 'beginner'
  },
  {
    id: 'communication',
    icon: '🗣',
    titleKey: 'templates.communication',
    bodyKey: 'templates.communicationBody',
    suggestedTags: ['communication', 'clarity', 'skills'],
    difficulty: 'beginner'
  },
  {
    id: 'reliability',
    icon: '✅',
    titleKey: 'templates.reliability',
    bodyKey: 'templates.reliabilityBody',
    suggestedTags: ['reliability', 'consistency', 'quality'],
    difficulty: 'intermediate'
  },
  {
    id: 'support',
    icon: '🤝',
    titleKey: 'templates.support',
    bodyKey: 'templates.supportBody',
    suggestedTags: ['support', 'helpfulness', 'teamwork'],
    difficulty: 'beginner'
  }
];

export function RecognitionTemplates({
  onSelectTemplate
}: RecognitionTemplatesProps): React.ReactElement {
  const t = (key: string) => useI18n(key);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const filteredTemplates = selectedDifficulty
    ? TEMPLATES.filter(t => t.difficulty === selectedDifficulty)
    : TEMPLATES;

  const handleTemplateClick = (template: RecognitionTemplate) => {
    onSelectTemplate(template);
  };

  return (
    <div className="recognition-templates" role="region" aria-label={t('templates.gallery')}>
      {/* Header */}
      <div className="templates-header">
        <h2 id="templates-title">{t('templates.useTemplate')}</h2>
        <p className="templates-subtitle">{t('templates.subtitle')}</p>
      </div>

      {/* Difficulty Filter */}
      <div className="templates-filter" role="group" aria-labelledby="difficulty-legend">
        <legend id="difficulty-legend" className="filter-legend">
          {t('templates.filterByDifficulty')}
        </legend>
        <div className="filter-buttons">
          <button
            onClick={() => setSelectedDifficulty(null)}
            className={`filter-btn ${selectedDifficulty === null ? 'active' : ''}`}
            aria-pressed={selectedDifficulty === null ? 'true' : 'false'}
          >
            {t('templates.allTemplates')}
          </button>
          <button
            onClick={() => setSelectedDifficulty('beginner')}
            className={`filter-btn ${selectedDifficulty === 'beginner' ? 'active' : ''}`}
            aria-pressed={selectedDifficulty === 'beginner' ? 'true' : 'false'}
          >
            {t('templates.beginner')} ⭐
          </button>
          <button
            onClick={() => setSelectedDifficulty('intermediate')}
            className={`filter-btn ${selectedDifficulty === 'intermediate' ? 'active' : ''}`}
            aria-pressed={selectedDifficulty === 'intermediate' ? 'true' : 'false'}
          >
            {t('templates.intermediate')} ⭐⭐
          </button>
          <button
            onClick={() => setSelectedDifficulty('advanced')}
            className={`filter-btn ${selectedDifficulty === 'advanced' ? 'active' : ''}`}
            aria-pressed={selectedDifficulty === 'advanced' ? 'true' : 'false'}
          >
            {t('templates.advanced')} ⭐⭐⭐
          </button>
        </div>
      </div>

      {/* Templates Gallery */}
      <ul className="templates-gallery">
        {filteredTemplates.map(template => (
          <li key={template.id}>
            <TemplateCard
              template={template}
              onSelect={handleTemplateClick}
              t={t}
            />
          </li>
        ))}
      </ul>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="templates-empty" role="status" aria-live="polite">
          <p>{t('templates.noTemplatesFound')}</p>
        </div>
      )}

      <style>{`
        .recognition-templates {
          width: 100%;
          padding: 24px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .templates-header {
          margin-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 16px;
        }

        .templates-header h2 {
          margin: 0 0 8px 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .templates-subtitle {
          margin: 0;
          font-size: 0.95rem;
          color: #6b7280;
          line-height: 1.5;
        }

        .templates-filter {
          margin-bottom: 24px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 6px;
        }

        .filter-legend {
          display: block;
          margin-bottom: 12px;
          font-weight: 600;
          color: #111827;
          font-size: 0.95rem;
        }

        .filter-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 2px solid #d1d5db;
          background: white;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
          color: #374151;
        }

        .filter-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .filter-btn:focus {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }

        .filter-btn.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .templates-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .templates-empty {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
          font-size: 1rem;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .recognition-templates {
            padding: 16px;
          }

          .templates-gallery {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
          }

          .filter-buttons {
            gap: 6px;
          }

          .filter-btn {
            padding: 6px 12px;
            font-size: 0.75rem;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .filter-btn,
          .template-card {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Individual Template Card Component
 */
interface TemplateCardProps {
  template: RecognitionTemplate;
  onSelect: (template: RecognitionTemplate) => void;
  t: (key: string) => string;
}

function TemplateCard({ template, onSelect, t }: TemplateCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const difficultyStars = template.difficulty === 'beginner'
    ? '⭐'
    : template.difficulty === 'intermediate'
    ? '⭐⭐'
    : '⭐⭐⭐';

  const handleClick = () => {
    onSelect(template);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="template-card">
      <button
        className="template-card-button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={t(template.titleKey)}
        title={`${t(template.titleKey)} - ${difficultyStars}`}
      >
        {/* Card Header */}
        <div className="card-header">
          <span className="card-icon" aria-hidden="true">
            {template.icon}
          </span>
          <h3 className="card-title">{t(template.titleKey)}</h3>
        </div>

        {/* Card Body */}
        <div className="card-body">
          <p className="card-description">{t(template.bodyKey)}</p>
        </div>

        {/* Card Meta */}
        <div className="card-meta">
          <span className="difficulty-indicator" aria-label={`${template.difficulty} difficulty`}>
            {difficultyStars}
          </span>
          <span className="badge badge-count">{template.suggestedTags.length} {t('templates.tags')}</span>
        </div>

        {/* CTA */}
        <div className="card-cta">
          <span className="cta-text">{t('templates.useThis')}</span>
          <span className="cta-arrow" aria-hidden="true">→</span>
        </div>
      </button>

      <style>{`
        .template-card {
          height: 100%;
        }

        .template-card-button {
          width: 100%;
          height: 100%;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s;
          font-family: inherit;
        }

        .template-card-button:hover {
          border-color: #2563eb;
          box-shadow: 0 4px 6px rgba(37,99,235,0.1);
          transform: translateY(-2px);
        }

        .template-card-button:focus {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }

        .template-card-button:active {
          transform: translateY(0);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .card-icon {
          font-size: 2rem;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          line-height: 1.4;
        }

        .card-body {
          flex: 1;
        }

        .card-description {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.5;
          min-height: 2.8em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .difficulty-indicator {
          letter-spacing: 1px;
        }

        .badge {
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          color: #374151;
        }

        .badge-count {
          background: #eff6ff;
          color: #1e40af;
        }

        .card-cta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          font-size: 0.875rem;
          font-weight: 600;
          color: #2563eb;
          transition: all 0.2s;
        }

        .cta-arrow {
          transition: transform 0.2s;
          display: inline-block;
        }

        .template-card-button:hover .cta-arrow {
          transform: translateX(4px);
        }

        /* Mobile */
        @media (max-width: 768px) {
          .template-card-button {
            padding: 12px;
            gap: 8px;
          }

          .card-icon {
            font-size: 1.5rem;
          }

          .card-title {
            font-size: 0.95rem;
          }

          .card-description {
            font-size: 0.8rem;
            min-height: 2.4em;
          }
        }

        /* High contrast mode */
        @media (prefers-contrast: more) {
          .template-card-button {
            border-width: 3px;
          }

          .template-card-button:focus {
            outline-width: 4px;
          }
        }
      `}</style>
    </div>
  );
}
