
import { useI18n, setLocale, getCurrentLocale, getAvailableLocales } from '../lib/i18n';
import type { ReactElement } from 'react';

export function LanguageSwitcher(): ReactElement {
  const saveText = useI18n('common.save');
  const cancelText = useI18n('common.cancel');
  const currentLocale = getCurrentLocale();
  const availableLocales = getAvailableLocales();

  const handleLocaleChange = (locale: 'en' | 'ta') => {
    setLocale(locale);
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold">Select Language</h3>
      
      <div className="flex gap-2">
        {availableLocales.map((locale) => (
          <button
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              currentLocale === locale
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {locale === 'en' ? 'English' : 'தமிழ்'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p><strong>Current locale:</strong> {currentLocale}</p>
        <p><strong>Save button text:</strong> {saveText}</p>
        <p><strong>Cancel button text:</strong> {cancelText}</p>
        <p><strong>Recognition button:</strong> {useI18n('recognize.button')}</p>
      </div>
      
      <div className="space-y-1">
        <p><strong>Interpolation example:</strong></p>
        <p>{useI18n('validation.minLength', { min: '20' })}</p>
      </div>
    </div>
  );
}