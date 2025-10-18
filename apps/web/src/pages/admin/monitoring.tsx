import React, { useState, useEffect } from 'react';
import { getFunctions } from '../../appwrite/client';

interface Metric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface SLO {
  name: string;
  target: number;
  current: number;
  breached: boolean;
}

interface Alert {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  resolved: boolean;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [slos, setSlos] = useState<SLO[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      // Mock metrics data for Phase 5 (recognition_created, recognition_failed, recognition_verified, upload_success, export_generated)
      const mockMetrics: Metric[] = [
        { name: 'recognition_created', value: 1245, unit: 'count', threshold: 1000, status: 'healthy' },
        { name: 'recognition_failed', value: 8, unit: 'count', threshold: 50, status: 'healthy' },
        { name: 'recognition_verified', value: 847, unit: 'count', threshold: 800, status: 'warning' },
        { name: 'upload_success', value: 98.2, unit: '%', threshold: 95, status: 'healthy' },
        { name: 'export_generated', value: 156, unit: 'count', threshold: 100, status: 'warning' },
        { name: 'worker_queue_length', value: 23, unit: 'jobs', threshold: 50, status: 'healthy' },
        { name: 'api_latency_p99', value: 245, unit: 'ms', threshold: 500, status: 'healthy' },
        { name: 'error_rate', value: 0.32, unit: '%', threshold: 1.0, status: 'healthy' },
      ];

      const mockSLOs: SLO[] = [
        { name: 'Availability', target: 99.95, current: 99.96, breached: false },
        { name: 'Latency (p99)', target: 500, current: 245, breached: false },
        { name: 'Error Rate', target: 0.5, current: 0.32, breached: false },
        { name: 'Recognition Created', target: 1000, current: 1245, breached: false },
      ];

      const mockAlerts: Alert[] = [
        {
          id: '1',
          title: 'High recognition_verified rate',
          severity: 'warning',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          resolved: false,
        },
        {
          id: '2',
          title: 'Upload success rate slightly below target',
          severity: 'info',
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          resolved: false,
        },
        {
          id: '3',
          title: 'Database connection recovered',
          severity: 'info',
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
          resolved: true,
        },
      ];

      setMetrics(mockMetrics);
      setSlos(mockSLOs);
      setAlerts(mockAlerts);
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Observability Monitoring (Phase 5)</h1>
          <p style={{ color: '#6b7280' }}>Real-time metrics, SLOs, and incident tracking</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh (30s)
        </label>
      </div>

      {loading ? (
        <p>Loading metrics...</p>
      ) : (
        <>
          {/* Key Metrics */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Key Metrics</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {metrics.map((metric) => (
                <div key={metric.name} style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.375rem',
                  border: `2px solid ${getStatusColor(metric.status)}`
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {metric.name.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827' }}>
                    {metric.value.toFixed(2)} <span style={{ fontSize: '0.875rem' }}>{metric.unit}</span>
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: getStatusColor(metric.status),
                    marginTop: '0.5rem',
                    textTransform: 'uppercase'
                  }}>
                    {metric.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLOs */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Service Level Objectives</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {slos.map((slo) => (
                <div key={slo.name} style={{
                  padding: '1rem',
                  backgroundColor: slo.breached ? '#fef3c7' : '#ecfdf5',
                  borderRadius: '0.375rem',
                  border: `1px solid ${slo.breached ? '#fcd34d' : '#86efac'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '600' }}>{slo.name}</span>
                    <span style={{ color: slo.breached ? '#f59e0b' : '#10b981' }}>
                      {slo.current.toFixed(2)} / {slo.target.toFixed(2)}
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min((slo.current / slo.target) * 100, 100)}%`,
                      height: '100%',
                      backgroundColor: slo.breached ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Active Alerts & Incidents</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {alerts.map((alert) => (
                <div key={alert.id} style={{
                  padding: '1rem',
                  backgroundColor: `${getSeverityColor(alert.severity)}15`,
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
                  borderRadius: '0.375rem',
                  opacity: alert.resolved ? 0.6 : 1,
                  textDecoration: alert.resolved ? 'line-through' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600', color: getSeverityColor(alert.severity) }}>
                      {alert.title}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {alert.resolved && (
                    <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.25rem' }}>
                      ✓ Resolved
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Phase 5 Features */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#eff6ff',
            borderRadius: '0.375rem',
            border: '1px solid #bfdbfe'
          }}>
            <strong>Phase 5 Observability Enabled:</strong>
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              <li>Prometheus metrics for recognition_created, recognition_failed, recognition_verified, upload_success, export_generated, worker_queue_length</li>
              <li>Distributed tracing across API workers and integrations</li>
              <li>Structured JSON logs with hashed IDs and event codes</li>
              <li>SLO dashboards and breach alerts</li>
              <li>Error tracking with sanitized context</li>
              <li>On-call rota and incident response runbooks</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
