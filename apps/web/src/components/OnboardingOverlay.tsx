import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { getOnboardingState, completeStep, skipAll, isCompleted, OnboardingState } from '../lib/onboarding';

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingOverlay({ open, onClose }: OnboardingOverlayProps): React.ReactElement | null {
  const t = (k: string, v?: Record<string, string>) => useI18n(k, v);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const steps: Array<{ key: 'integrations' | 'first_recognition' | 'invite_teammates'; title: string; desc: string; cta?: { label: string; action: () => void } }> = [
    {
      key: 'integrations',
      title: t('onboarding.connect_integrations'),
      desc: t('onboarding.connect_integrations_desc'),
      cta: {
        label: t('onboarding.open_slack_setup'),
        action: () => {
          window.location.href = '/admin/monitoring';
        },
      },
    },
    {
      key: 'first_recognition',
      title: t('onboarding.give_first'),
      desc: t('onboarding.give_first_desc'),
      cta: {
        label: t('recognize.button'),
        action: () => {
          window.location.href = '/feed';
        },
      },
    },
    {
      key: 'invite_teammates',
      title: t('onboarding.invite'),
      desc: t('onboarding.invite_desc'),
      cta: {
        label: t('onboarding.send_invites'),
        action: () => {
          // In a real app, open invite modal. Here, just mark done.
        },
      },
    },
  ];

  useEffect(() => {
    if (!open) return;
    (async () => {
      const s = await getOnboardingState();
      setState(s);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const el = dialogRef.current;
    const prevActive = document.activeElement as HTMLElement | null;
    const focusables = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const items = Array.from(focusables);
        const idx = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          if (idx <= 0) {
            e.preventDefault();
            items[items.length - 1]?.focus();
          }
        } else {
          if (idx === items.length - 1) {
            e.preventDefault();
            items[0]?.focus();
          }
        }
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      prevActive?.focus();
    };
  }, [open, onClose]);

  if (!open || !state) return null;

  const completed = isCompleted(state);
  const current = steps[stepIndex];
  const currentDone = state.completed[current.key];

  const markDone = async () => {
    const next = await completeStep(current.key);
    setState(next);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  };

  const onSkip = async () => {
    const next = await skipAll();
    setState(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('onboarding.aria_modal_label')}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} className="relative mx-auto mt-20 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" aria-live="polite" aria-atomic="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t('onboarding.title')}</h2>
            <p className="text-sm text-gray-600">{t('onboarding.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label={t('onboarding.close')}>✕</button>
        </div>

        {/* Progress */}
        <div className="mt-4" role="status" aria-label={t('onboarding.aria_progress')}>
          <div className="h-2 w-full rounded bg-gray-200">
            <div className="h-2 rounded bg-blue-600" data-width={`${((stepIndex + 1) / steps.length) * 100}%`} />
          </div>
          <p className="mt-1 text-xs text-gray-600">{t('onboarding.progress', { current: String(stepIndex + 1), total: String(steps.length) })}</p>
        </div>

        {/* Step */}
        <div className="mt-6">
          <h3 className="text-lg font-medium">{current.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{current.desc}</p>
          <div className="mt-4 flex items-center gap-2">
            {current.cta && (
              <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={current.cta.action}>{current.cta.label}</button>
            )}
            {!currentDone && (
              <button className="px-4 py-2 border rounded hover:bg-gray-50" onClick={markDone}>{t('onboarding.done')}</button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <button className="text-sm text-gray-600 hover:text-gray-800 underline" onClick={onSkip}>{t('onboarding.skip_all')}</button>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border rounded disabled:opacity-50" onClick={() => setStepIndex(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>{t('onboarding.back')}</button>
            <button className="px-3 py-1.5 border rounded disabled:opacity-50" onClick={() => setStepIndex(Math.min(steps.length - 1, stepIndex + 1))} disabled={stepIndex === steps.length - 1}>{t('onboarding.next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingOverlay;
