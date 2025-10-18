// i18n Tests - Translation and Locale Functionality
import { setLocale, getCurrentLocale, translate } from '../../apps/web/src/lib/i18n';

// Simple mock for localStorage
const mockStorage = {
  storage: new Map(),
  getItem: function(key) { return this.storage.get(key) || null; },
  setItem: function(key, value) { this.storage.set(key, value); },
  clear: function() { this.storage.clear(); },
  length: 0,
  key: function() { return null; },
  removeItem: function(key) { this.storage.delete(key); }
};

// Mock global environment
global.localStorage = mockStorage;
global.window = {
  localStorage: mockStorage,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
};

describe('i18n System', () => {
  beforeEach(() => {
    mockStorage.clear();
    setLocale('en');
  });

  describe('Translation Functions', () => {
    it('should return English translation by default', () => {
      const translation = translate('recognize.button');
      expect(translation).toBe('Give Recognition');
    });

    it('should return Tamil translation when locale is Tamil', () => {
      setLocale('ta');
      const translation = translate('recognize.button');
      expect(translation).toBe('அங்கீகாரம் அளிக்கவும்');
    });

    it('should interpolate variables correctly', () => {
      const translation = translate('validation.minLength', { min: '5' });
      expect(translation).toBe('Must be at least 5 characters');
    });

    it('should handle nested translation keys', () => {
      const translation = translate('recognize.visibility.private');
      expect(translation).toBe('Private');
    });

    it('should fallback to key when translation is missing', () => {
      const translation = translate('missing.translation.key');
      expect(translation).toBe('missing.translation.key');
    });

    it('should handle variable interpolation with Tamil text', () => {
      setLocale('ta');
      const translation = translate('feed.ago', { time: '5 நிமிடம்' });
      expect(translation).toBe('5 நிமிடம் முன்பு');
    });
  });

  describe('Locale Management', () => {
    it('should get current locale', () => {
      expect(getCurrentLocale()).toBe('en');
      
      setLocale('ta');
      expect(getCurrentLocale()).toBe('ta');
    });

    it('should persist locale to localStorage', () => {
      setLocale('ta');
      expect(mockStorage.getItem('preferred-locale')).toBe('ta');
      
      setLocale('en');
      expect(mockStorage.getItem('preferred-locale')).toBe('en');
    });

    it('should switch between locales correctly', () => {
      // Start with English
      expect(translate('common.save')).toBe('Save');
      
      // Switch to Tamil
      setLocale('ta');
      expect(translate('common.save')).toBe('சேமிக்கவும்');
      
      // Switch back to English
      setLocale('en');
      expect(translate('common.save')).toBe('Save');
    });
  });

  describe('Translation Completeness', () => {
    const requiredKeys = [
      'recognize.button',
      'recognize.title',
      'common.save',
      'common.cancel',
      'feed.title',
      'profile.title',
      'auth.signIn',
      'verification.title',
    ];

    test.each(requiredKeys)('should have English translation for %s', (key) => {
      setLocale('en');
      const translation = translate(key);
      expect(translation).not.toBe(key);
      expect(translation.length).toBeGreaterThan(0);
    });

    test.each(requiredKeys)('should have Tamil translation for %s', (key) => {
      setLocale('ta');
      const translation = translate(key);
      expect(translation).not.toBe(key);
      expect(translation.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty translation keys gracefully', () => {
      const translation = translate('');
      expect(translation).toBe('');
    });

    it('should handle undefined variables in interpolation', () => {
      const translation = translate('validation.minLength', { min: undefined });
      expect(translation).toContain('undefined');
    });

    it('should not crash with deeply nested missing keys', () => {
      const translation = translate('very.deeply.nested.missing.key');
      expect(translation).toBe('very.deeply.nested.missing.key');
    });

    it('should handle null values in interpolation', () => {
      const translation = translate('feed.ago', { time: null });
      expect(translation).toContain('null');
    });
  });

  describe('Complex Scenarios', () => {
    it('should maintain correct translations across multiple locale switches', () => {
      // Test multiple switches
      setLocale('en');
      expect(translate('recognize.button')).toBe('Give Recognition');
      
      setLocale('ta');
      expect(translate('recognize.button')).toBe('அங்கீகாரம் அளிக்கவும்');
      
      setLocale('en');
      expect(translate('recognize.button')).toBe('Give Recognition');
      
      setLocale('ta');
      expect(translate('recognize.button')).toBe('அங்கீகாரம் அளிக்கவும்');
    });

    it('should handle complex interpolation with multiple variables', () => {
      const translation = translate('feed.verifiedBy', { name: 'John Doe' });
      expect(translation).toBe('Verified by John Doe');
      
      setLocale('ta');
      const tamilTranslation = translate('feed.verifiedBy', { name: 'ஜான் டோ' });
      expect(tamilTranslation).toBe('ஜான் டோ ஆல் சரிபார்க்கப்பட்டது');
    });

    it('should handle missing interpolation variables gracefully', () => {
      const translation = translate('validation.minLength');
      expect(translation).toBe('Must be at least {{min}} characters');
    });
  });
});