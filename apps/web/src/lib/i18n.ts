
import { useState, useEffect, useMemo } from 'react';

// Import translation files
import enTranslations from '../../../../i18n/en.json';
import taTranslations from '../../../../i18n/ta.json';

type Translations = {
  [key: string]: string | Translations;
};

type Locale = 'en' | 'ta';

const translations: Record<Locale, Translations> = {
  en: enTranslations,
  ta: taTranslations,
};

// Tamil Nadu locale heuristics
function detectTamilLocale(): boolean {
  // Check browser language settings
  const browserLang = navigator.language || navigator.languages?.[0] || '';
  if (browserLang.includes('ta') || browserLang.includes('TN')) {
    return true;
  }

  // Check timezone (Tamil Nadu uses IST)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone === 'Asia/Kolkata' || timezone === 'Asia/Calcutta') {
    // Additional checks could be added here for more specific detection
    return true;
  }

  // Check for saved preference
  const savedLocale = localStorage.getItem('preferred-locale');
  return savedLocale === 'ta';
}

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

function interpolateString(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] || match;
  });
}

let currentLocale: Locale = detectTamilLocale() ? 'ta' : 'en';

// Hook for using translations
export function useI18n(key: string, vars?: Record<string, string>): string {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  const translation = useMemo(() => {
    // Try to get translation from current locale
    let value = getNestedValue(translations[locale], key);
    
    // Fallback to English if not found
    if (value === undefined) {
      value = getNestedValue(translations.en, key);
    }
    
    // Fallback to key if still not found
    if (value === undefined) {
      console.warn(`Missing translation for key: ${key} in locale: ${locale}`);
      return key;
    }

    // Interpolate variables if provided
    return vars ? interpolateString(value, vars) : value;
  }, [key, locale, vars]);

  // Update locale when it changes globally
  useEffect(() => {
    const handleLocaleChange = (e: Event) => {
      // Prefer event detail if available; fallback to persisted value; finally module state
      const detailLocale = (e as CustomEvent).detail as Locale | undefined;
      const persisted = (typeof localStorage !== 'undefined' && localStorage.getItem('preferred-locale')) as Locale | null;
      const next = detailLocale || persisted || currentLocale;
      setLocaleState(next);
    };

    window.addEventListener('locale-change', handleLocaleChange as EventListener);
    return () => window.removeEventListener('locale-change', handleLocaleChange as EventListener);
  }, []);

  return translation;
}

// Function to change locale globally
export function setLocale(newLocale: Locale): void {
  currentLocale = newLocale;
  localStorage.setItem('preferred-locale', newLocale);
  
  // Dispatch event with detail to notify all useI18n hooks reliably across module instances
  window.dispatchEvent(new CustomEvent('locale-change', { detail: newLocale }));
}

// Function to get current locale
export function getCurrentLocale(): Locale {
  return currentLocale;
}

// Function to get available locales
export function getAvailableLocales(): Locale[] {
  return ['en', 'ta'];
}

// Function to get translation without hook (for use outside components)
export function translate(key: string, vars?: Record<string, string>): string {
  let value = getNestedValue(translations[currentLocale], key);
  
  // Fallback to English if not found
  if (value === undefined) {
    value = getNestedValue(translations.en, key);
  }
  
  // Fallback to key if still not found
  if (value === undefined) {
    console.warn(`Missing translation for key: ${key} in locale: ${currentLocale}`);
    return key;
  }

  // Interpolate variables if provided
  return vars ? interpolateString(value, vars) : value;
}