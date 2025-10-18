import React, { useState, useEffect } from 'react';
import { useI18n } from '../lib/i18n';

interface ChecklistStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  isComplete: boolean;
  icon: '📋' | '👥' | '✉️' | '✓';
}

interface ManagerChecklistProps {
  userId: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

const STORAGE_KEY = 'recognition:onboarding:manager';

/**
 * ManagerChecklist Component
 * 
 * Guides new managers through a 4-step setup process:
 * 1. Create Team
 * 2. Add Team Members
 * 3. Send Welcome Email
 * 4. Review First Recognition
 * 
 * WCAG 2.1 AA Compliant:
 * - Progress bar with aria-valuenow
 * - Keyboard navigation
 * - Screen reader announcements
 * - Focus management
 */
export function ManagerChecklist({
  userId,
  onComplete,
  onDismiss
}: ManagerChecklistProps): React.ReactElement | null {
  const t = (key: string, vars?: Record<string, string>) => useI18n(key, vars);
  
  const [steps, setSteps] = useState<ChecklistStep[]>([
    {
      id: 'create-team',
      titleKey: 'checklist.step1',
      descriptionKey: 'checklist.step1Desc',
      isComplete: false,
      icon: '📋'
    },
    {
      id: 'add-members',
      titleKey: 'checklist.step2',
      descriptionKey: 'checklist.step2Desc',
      isComplete: false,
      icon: '👥'
    },
    {
      id: 'send-welcome',
      titleKey: 'checklist.step3',
      descriptionKey: 'checklist.step3Desc',
      isComplete: false,
      icon: '✉️'
    },
    {
      id: 'review-recognition',
      titleKey: 'checklist.step4',
      descriptionKey: 'checklist.step4Desc',
      isComplete: false,
      icon: '✓'
    }
  ]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load completion status from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.userId === userId) {
          setSteps(data.steps);
          setCurrentStep(data.currentStep);
          setIsDismissed(data.isDismissed || false);
        }
      } catch (error) {
        console.warn('Failed to load manager checklist:', error);
      }
    }
  }, [userId]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userId,
        steps,
        currentStep,
        isDismissed,
        lastUpdated: new Date().toISOString()
      })
    );
  }, [userId, steps, currentStep, isDismissed]);

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPercentage = (completedCount / steps.length) * 100;
  const isFullyComplete = completedCount === steps.length;

  const handleStepComplete = (stepId: string) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, isComplete: true } : step
      )
    );

    // Move to next incomplete step
    const nextIncompleteIndex = steps.findIndex(
      (s, i) => i > currentStep && !s.isComplete
    );

    if (nextIncompleteIndex !== -1) {
      setCurrentStep(nextIncompleteIndex);
    }

    // Check if all steps are complete
    const newSteps = steps.map(s =>
      s.id === stepId ? { ...s, isComplete: true } : s
    );
    if (newSteps.every(s => s.isComplete)) {
      onComplete?.();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleSkipStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Hide checklist if dismissed or fully complete
  if (isDismissed || isFullyComplete) {
    return null;
  }

  const step = steps[currentStep];

  return (
    <div
      className="manager-checklist"
      role="complementary"
      aria-label={t('checklist.managerSetup')}
    >
      {/* Header */}
      <div className="checklist-header">
        <div className="checklist-title">
          <h2 id="checklist-title">{t('checklist.managerSetup')}</h2>
          <button
            onClick={handleDismiss}
            className="checklist-close"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div
          className="checklist-progress-container"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label={t('checklist.progress', {
            current: String(completedCount),
            total: String(steps.length)
          })}
        >
          <div className="checklist-progress-bar">
            <div
              className="checklist-progress-fill"
              style={{ width: `${progressPercentage}%` }}
              aria-hidden="true"
            />
          </div>
          <span className="checklist-progress-text">
            {completedCount} / {steps.length}
          </span>
        </div>
      </div>

      {/* Step List */}
      <ul className="checklist-steps" role="list">
        {steps.map((s, index) => (
          <li
            key={s.id}
            className={`checklist-step ${s.isComplete ? 'complete' : ''} ${
              index === currentStep ? 'current' : ''
            }`}
            role="listitem"
          >
            <div className="step-checkbox">
              {s.isComplete ? (
                <span className="step-icon-complete" aria-hidden="true">
                  ✓
                </span>
              ) : (
                <span className="step-icon" aria-hidden="true">
                  {s.icon}
                </span>
              )}
            </div>

            <div className="step-content">
              <h3 className="step-title">{t(s.titleKey)}</h3>
              <p className="step-description">{t(s.descriptionKey)}</p>
            </div>

            {!s.isComplete && index === currentStep && (
              <button
                onClick={() => handleStepComplete(s.id)}
                className="step-action-button"
                aria-label={t('checklist.markComplete')}
              >
                {t('checklist.markComplete')}
              </button>
            )}

            {s.isComplete && (
              <span className="step-complete-badge" aria-hidden="true">
                ✓
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Current Step Details */}
      {!step.isComplete && (
        <div
          className="checklist-current-step"
          role="region"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="step-details-content">
            <h3>{t(step.titleKey)}</h3>
            <p>{t(step.descriptionKey)}</p>

            {/* Step-specific guidance */}
            {step.id === 'create-team' && (
              <div className="step-guidance">
                <ol>
                  <li>{t('checklist.step1Guide1')}</li>
                  <li>{t('checklist.step1Guide2')}</li>
                  <li>{t('checklist.step1Guide3')}</li>
                </ol>
              </div>
            )}

            {step.id === 'add-members' && (
              <div className="step-guidance">
                <ol>
                  <li>{t('checklist.step2Guide1')}</li>
                  <li>{t('checklist.step2Guide2')}</li>
                  <li>{t('checklist.step2Guide3')}</li>
                </ol>
              </div>
            )}

            {step.id === 'send-welcome' && (
              <div className="step-guidance">
                <ol>
                  <li>{t('checklist.step3Guide1')}</li>
                  <li>{t('checklist.step3Guide2')}</li>
                  <li>{t('checklist.step3Guide3')}</li>
                </ol>
              </div>
            )}

            {step.id === 'review-recognition' && (
              <div className="step-guidance">
                <ol>
                  <li>{t('checklist.step4Guide1')}</li>
                  <li>{t('checklist.step4Guide2')}</li>
                  <li>{t('checklist.step4Guide3')}</li>
                </ol>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="step-actions">
            <button
              onClick={() => handleStepComplete(step.id)}
              className="btn btn-primary"
              aria-label={t('checklist.markComplete')}
            >
              {t('checklist.markComplete')}
            </button>
            {currentStep < steps.length - 1 && (
              <button
                onClick={handleSkipStep}
                className="btn btn-secondary"
                aria-label={t('checklist.skip')}
              >
                {t('checklist.skip')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isFullyComplete && (
        <div
          className="checklist-complete"
          role="status"
          aria-live="polite"
        >
          <div className="complete-icon">🎉</div>
          <h3>{t('checklist.allStepsComplete')}</h3>
          <p>{t('checklist.readyToStart')}</p>
          <button
            onClick={handleDismiss}
            className="btn btn-primary"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      <style>{`
        .manager-checklist {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .checklist-header {
          margin-bottom: 24px;
        }

        .checklist-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .checklist-title h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .checklist-close {
          background: transparent;
          border: 2px solid #d1d5db;
          width: 36px;
          height: 36px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .checklist-close:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .checklist-close:focus {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }

        .checklist-progress-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .checklist-progress-bar {
          flex: 1;
          height: 8px;
          background: #f3f4f6;
          border-radius: 999px;
          overflow: hidden;
        }

        .checklist-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #06b6d4);
          transition: width 0.3s ease;
          border-radius: 999px;
        }

        .checklist-progress-text {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          min-width: 40px;
        }

        .checklist-steps {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checklist-step {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          transition: all 0.2s;
          background: #f9fafb;
        }

        .checklist-step.current {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .checklist-step.complete {
          opacity: 0.7;
        }

        .step-checkbox {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }

        .checklist-step.current .step-checkbox {
          background: #2563eb;
          color: white;
        }

        .checklist-step.complete .step-checkbox {
          background: #10b981;
          color: white;
        }

        .step-icon-complete {
          font-weight: 700;
        }

        .step-content {
          flex: 1;
        }

        .step-title {
          margin: 0 0 4px 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
        }

        .step-description {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .step-complete-badge {
          flex-shrink: 0;
          font-size: 1.5rem;
          color: #10b981;
        }

        .step-action-button {
          flex-shrink: 0;
          padding: 6px 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .step-action-button:hover {
          background: #1d4ed8;
        }

        .step-action-button:focus {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }

        .checklist-current-step {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .step-details-content h3 {
          margin: 0 0 12px 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
        }

        .step-details-content p {
          margin: 0 0 12px 0;
          color: #4b5563;
          line-height: 1.6;
        }

        .step-guidance {
          margin: 16px 0;
          background: white;
          padding: 16px;
          border-radius: 4px;
          border-left: 4px solid #2563eb;
        }

        .step-guidance ol {
          margin: 0;
          padding-left: 24px;
          color: #374151;
        }

        .step-guidance li {
          margin-bottom: 8px;
          line-height: 1.6;
        }

        .step-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          font-size: 0.95rem;
        }

        .btn:focus {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-secondary {
          background: transparent;
          color: #2563eb;
          border: 2px solid #bfdbfe;
        }

        .btn-secondary:hover {
          background: #eef2ff;
        }

        .checklist-complete {
          text-align: center;
          padding: 32px 24px;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          border-radius: 6px;
        }

        .complete-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .checklist-complete h3 {
          margin: 0 0 8px 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #15803d;
        }

        .checklist-complete p {
          margin: 0 0 16px 0;
          color: #4b5563;
        }

        /* Mobile responsiveness */
        @media (max-width: 640px) {
          .manager-checklist {
            padding: 16px;
          }

          .checklist-step {
            flex-direction: column;
          }

          .step-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }

          .checklist-close {
            width: 32px;
            height: 32px;
            font-size: 1rem;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .checklist-progress-fill {
            transition: none;
          }

          .step-action-button,
          .btn {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
