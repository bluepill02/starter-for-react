// Sign-In Page with OAuth Integration
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { announcePolite, announceAssertive } from '../lib/liveRegion';
import { useI18n, getAvailableLocales, getCurrentLocale, setLocale } from '../lib/i18n';

export function SignInPage(): React.ReactElement {
  const navigate = useNavigate();
  const { signInWithOAuth, signInWithEmail, signUp, signInWithMagicLink, loading } = useAuth();
  const t = (key: string, vars?: Record<string, string>) => useI18n(key, vars);
  const [lang, setLang] = useState(getCurrentLocale());
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [emailMode, setEmailMode] = useState<'hidden' | 'magic' | 'password'>('hidden');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'microsoft' | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await signInWithEmail(email, password);
      navigate('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      await signUp(email, password, name);
      navigate('/feed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'microsoft') => {
    setError(null);
    setOauthLoading(provider);
    
    try {
      announcePolite(t('signin.processing_oauth', { provider }), 1500);
      await signInWithOAuth(provider);
      // OAuth redirects, so navigation happens after callback
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signin.oauth_failed'));
      setOauthLoading(null);
      announceAssertive(t('signin.oauth_failed'), 2000);
    }
  };

  const handleSendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMagicSent(false);
    try {
      await signInWithMagicLink(email);
      setMagicSent(true);
      announcePolite(t('signin.email_sent_to', { email }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signin.error_generic'));
      announceAssertive(t('signin.error_generic'), 2000);
    }
  };

  const onLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as 'en' | 'ta';
    setLang(next);
    setLocale(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('signin.title')}</h1>
          <p className="text-gray-600">{t('signin.subtitle')}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <label htmlFor="lang" className="sr-only">{t('signin.language')}</label>
            <select id="lang" aria-label={t('signin.language')} className="px-2 py-1 border rounded lang-select" value={lang} onChange={onLangChange}>
              {getAvailableLocales().map((loc) => (
                <option key={loc} value={loc}>{loc === 'en' ? 'English' : 'தமிழ்'}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          </div>
        )}

        {/* OAuth Options */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleOAuthSignIn('google')}
            disabled={loading || oauthLoading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Sign in with Google"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {oauthLoading === 'google' ? t('common.loading') : t('signin.google')}
          </button>

          <button
            onClick={() => handleOAuthSignIn('microsoft')}
            disabled={loading || oauthLoading !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Sign in with Microsoft"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="13" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="13" width="9" height="9" fill="#00A4EF"/>
              <rect x="13" y="13" width="9" height="9" fill="#FFB900"/>
            </svg>
            {oauthLoading === 'microsoft' ? t('common.loading') : t('signin.microsoft')}
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <button
              type="button"
              onClick={() => setEmailMode(emailMode === 'hidden' ? 'magic' : 'hidden')}
              className="px-2 bg-white text-blue-600 hover:text-blue-700"
            >
              {t('signin.using_email')}
            </button>
          </div>
        </div>

        {/* Email Forms */}
        {emailMode === 'magic' && (
          <form onSubmit={handleSendMagic} className="space-y-4" aria-label="Magic link sign-in">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('signin.email_label')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || oauthLoading !== null}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {t('signin.send_magic')}
            </button>
            {magicSent && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2" role="status">
                {t('signin.magic_sent')}
              </p>
            )}
            <div className="text-center">
              <button type="button" className="text-sm text-gray-600 hover:text-gray-800 underline" onClick={() => setEmailMode('password')}>
                {t('signin.using_password')}
              </button>
            </div>
          </form>
        )}

        {emailMode === 'password' && (
        <form onSubmit={mode === 'signin' ? handleEmailSignIn : handleSignUp} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {t('signin.name_label')}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="name"
                required={mode === 'signup'}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('signin.email_label')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete={'email'}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('signin.password_label')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {mode === 'signin' 
              ? loading ? t('common.loading') : t('signin.sign_in')
              : loading ? t('common.loading') : t('signin.sign_up')
            }
          </button>
        </form>
        )}

        {/* Mode Toggle */}
        <div className="mt-6 text-center text-sm">
          {mode === 'signin' ? (
            <>
              {t('signin.no_account')}{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('signin.sign_up')}
              </button>
            </>
          ) : (
            <>
              {t('signin.have_account')}{' '}
              <button
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('signin.sign_in')}
              </button>
            </>
          )}
        </div>

        {/* Links */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <a href="/auth/forgot" className="hover:text-gray-700">{t('signin.forgot')}</a>
          <div className="space-x-3">
            <a href="/legal/terms" target="_blank" rel="noreferrer" className="hover:text-gray-700">Terms</a>
            <a href="/legal/privacy" target="_blank" rel="noreferrer" className="hover:text-gray-700">Privacy</a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-500 text-center space-y-1">
          <p>{t('signin.terms')}</p>
          <p>{t('signin.privacy')}</p>
        </div>
      </div>
    </div>
  );
}
