// OAuth Callback Handler Page
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

export function OAuthCallbackPage(): React.ReactElement {
  const navigate = useNavigate();
  const { refreshUser, currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your sign-in...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract OAuth parameters
        const userId = searchParams.get('userId');
        const secret = searchParams.get('secret');
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Log for debugging
        console.log('OAuth callback params:', { userId, secret, code, state });

        // Refresh user data after OAuth success
        if (userId || code) {
          await refreshUser();
          setStatus('success');
          setMessage('Sign-in successful! Redirecting...');
          
          // Redirect to feed after short delay
          setTimeout(() => {
            navigate('/feed', { replace: true });
          }, 1000);
        } else {
          throw new Error('Missing OAuth parameters');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(
          error instanceof Error 
            ? error.message 
            : 'Failed to process sign-in. Please try again.'
        );
      }
    };

    // Only process if we're on the callback page with parameters
    if (searchParams.size > 0) {
      handleCallback();
    }
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {status === 'processing' && 'Signing In'}
          {status === 'success' && '✓ Success'}
          {status === 'error' && '✗ Error'}
        </h1>

        {/* Status Animation */}
        {status === 'processing' && (
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-2xl">✕</span>
            </div>
          </div>
        )}

        {/* Message */}
        <p className="text-gray-600 mb-6">{message}</p>

        {/* Current User Info */}
        {currentUser && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Signed in as:</p>
            <p className="font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-sm text-gray-500">{currentUser.email}</p>
          </div>
        )}

        {/* Action Buttons */}
        {status === 'error' && (
          <div className="space-y-3">
            <button
              onClick={() => navigate('/sign-in', { replace: true })}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Go to Home
            </button>
          </div>
        )}

        {status === 'success' && (
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        )}

        {status === 'processing' && (
          <p className="text-sm text-gray-500">
            Please wait while we complete your sign-in
          </p>
        )}
      </div>
    </div>
  );
}
