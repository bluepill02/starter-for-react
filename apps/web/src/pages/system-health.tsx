import React, { useState, useEffect } from 'react';
import { getFunctions } from '../appwrite/client';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  functions: Record<string, any>;
  database: Record<string, any>;
  metrics: Record<string, any>;
}

export default function HealthCheckPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const functions = getFunctions();
      const response = await functions.createExecution(
        'health-check',
        JSON.stringify({}),
        false
      );
      if (response.responseBody) {
        setHealth(JSON.parse(response.responseBody));
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch health status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'healthy':
        return { border: 'border-green-500', dot: 'bg-green-500' };
      case 'degraded':
        return { border: 'border-yellow-500', dot: 'bg-yellow-500' };
      case 'unhealthy':
        return { border: 'border-red-500', dot: 'bg-red-500' };
      default:
        return { border: 'border-gray-400', dot: 'bg-gray-400' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
            <p className="text-gray-600">Monitoring Phase 3C observability</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh (5s)
            </label>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 mb-6" role="alert">{error}</div>
        )}

        {loading ? (
          <div className="text-gray-600">Loading health status...</div>
        ) : health ? (
          <>
            <section className={`p-6 bg-white rounded-lg border-2 mb-8 ${getStatusClasses(health.status).border}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`w-4 h-4 rounded-full ${getStatusClasses(health.status).dot}`}></span>
                <div>
                  <h2 className="text-xl font-semibold uppercase text-gray-900">{health.status}</h2>
                  <p className="text-gray-500 text-sm">{new Date(health.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {health.functions && (
                <section className="p-6 bg-white rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Function Status</h3>
                  <div className="mt-4 divide-y divide-gray-200">
                    {Object.entries(health.functions).map(([key, value]: any) => (
                      <div key={key} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-gray-700">{key}</span>
                        <span className={value.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
                          {value.status === 'ok' ? '✓ OK' : '✗ ERROR'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {health.database && (
                <section className="p-6 bg-white rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Database Status</h3>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    {Object.entries(health.database).map(([key, value]: any) => (
                      <div key={key}>
                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {health.metrics && (
                <section className="p-6 bg-white rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Metrics</h3>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    {Object.entries(health.metrics).map(([key, value]: any) => (
                      <div key={key}>
                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
