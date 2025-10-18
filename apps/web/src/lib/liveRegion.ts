// Centralized ARIA live region helpers for accessible announcements
// Creates and reuses a single pair of polite/assertive regions to avoid DOM churn

const POLITE_ID = 'app-live-region-polite';
const ASSERTIVE_ID = 'app-live-region-assertive';

function ensureRegion(id: string, politeness: 'polite' | 'assertive'): HTMLElement {
  let el = document.getElementById(id) as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    // Ensure it's attached near the end of body
    document.body.appendChild(el);
  }
  return el;
}

export function initLiveRegions(): void {
  if (typeof document === 'undefined') return;
  ensureRegion(POLITE_ID, 'polite');
  ensureRegion(ASSERTIVE_ID, 'assertive');
}

function announce(id: string, politeness: 'polite' | 'assertive', message: string, timeout = 2000): void {
  if (typeof document === 'undefined') return;
  const region = ensureRegion(id, politeness);
  region.textContent = message;
  // Clear after timeout to allow subsequent announcements with same text
  window.setTimeout(() => {
    if (region) region.textContent = '';
  }, timeout);
}

export function announcePolite(message: string, timeout?: number): void {
  announce(POLITE_ID, 'polite', message, timeout);
}

export function announceAssertive(message: string, timeout?: number): void {
  announce(ASSERTIVE_ID, 'assertive', message, timeout);
}
