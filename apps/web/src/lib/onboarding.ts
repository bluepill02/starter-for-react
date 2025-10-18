import { getAccount } from '../appwrite/client';

export type OnboardingStep = 'integrations' | 'first_recognition' | 'invite_teammates';

export interface OnboardingState {
  completed: Record<OnboardingStep, boolean>;
  skipped: boolean;
  lastUpdated: string;
}

const DEFAULT_STATE: OnboardingState = {
  completed: {
    integrations: false,
    first_recognition: false,
    invite_teammates: false,
  },
  skipped: false,
  lastUpdated: new Date().toISOString(),
};

const ONBOARDING_PREF_KEY = 'onboarding';

export async function getOnboardingState(): Promise<OnboardingState> {
  const account = getAccount();
  try {
    const user = await account.get();
    const prefs = (user.prefs || {}) as any;
    const state = prefs[ONBOARDING_PREF_KEY] as OnboardingState | undefined;
    if (!state) return { ...DEFAULT_STATE };
    // Merge to ensure new keys get defaults
    return {
      ...DEFAULT_STATE,
      ...state,
      completed: { ...DEFAULT_STATE.completed, ...(state.completed || {}) },
    };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

export async function setOnboardingState(state: OnboardingState): Promise<void> {
  const account = getAccount();
  const user = await account.get();
  const prefs = (user.prefs || {}) as any;
  prefs[ONBOARDING_PREF_KEY] = { ...state, lastUpdated: new Date().toISOString() };
  await account.updatePrefs(prefs);
}

export async function completeStep(step: OnboardingStep): Promise<OnboardingState> {
  const current = await getOnboardingState();
  const next: OnboardingState = {
    ...current,
    completed: { ...current.completed, [step]: true },
    lastUpdated: new Date().toISOString(),
  };
  await setOnboardingState(next);
  return next;
}

export async function skipAll(): Promise<OnboardingState> {
  const next: OnboardingState = {
    ...DEFAULT_STATE,
    skipped: true,
    completed: { integrations: true, first_recognition: true, invite_teammates: true },
    lastUpdated: new Date().toISOString(),
  };
  await setOnboardingState(next);
  return next;
}

export function isCompleted(state: OnboardingState): boolean {
  const c = state.completed;
  return c.integrations && c.first_recognition && c.invite_teammates;
}
