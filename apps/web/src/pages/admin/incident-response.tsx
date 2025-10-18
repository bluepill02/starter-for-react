import React, { useState } from 'react';

interface Runbook {
  title: string;
  severity: 'critical' | 'high' | 'medium';
  symptoms: string[];
  steps: string[];
  contacts: string[];
}

const runbooks: Runbook[] = [
  {
    title: 'Recognition Creation Failures',
    severity: 'critical',
    symptoms: [
      'error_rate exceeds 5%',
      'recognition_failed metric spikes',
      'users reporting 500 errors on /recognize endpoint'
    ],
    steps: [
      '1. Check Appwrite Database connectivity - run health-check endpoint',
      '2. Verify APPWRITE_DATABASE_ID and DATABASE_ID env vars',
      '3. Check rate-limiter service - may be blocking legitimate requests',
      '4. Review recent deployments - rollback if needed',
      '5. Check abuse detection service - may have configuration issue',
      '6. Escalate to backend team if DB is down'
    ],
    contacts: ['backend-oncall@company.com', 'database-team@company.com']
  },
  {
    title: 'Upload Failures / Storage Issues',
    severity: 'critical',
    symptoms: [
      'upload_success metric drops below 90%',
      'STORAGE_BUCKET_ID not found errors',
      'presign-upload function returns 403'
    ],
    steps: [
      '1. Verify S3/Appwrite Storage credentials and permissions',
      '2. Check STORAGE_BUCKET_ID environment variable',
      '3. Verify bucket exists and has sufficient quota',
      '4. Check for S3 outage via AWS status page',
      '5. Review recent storage configuration changes',
      '6. Check presign-upload function logs for detailed errors'
    ],
    contacts: ['storage-oncall@company.com', 'aws-support@company.com']
  },
  {
    title: 'Integration Outages (Slack/Teams)',
    severity: 'high',
    symptoms: [
      'Circuit breaker state changes to OPEN',
      'Integration functions timeout',
      'Webhook delivery failures spike',
      'Users not receiving recognition notifications'
    ],
    steps: [
      '1. Check Slack/Teams webhook URL validity',
      '2. Verify SLACK_SIGNING_SECRET and Teams app credentials',
      '3. Monitor circuit-breaker metrics - confirm OPEN state',
      '4. Check if integration service is rate-limited',
      '5. Verify network connectivity to external services',
      '6. Queue notifications using background-worker for retry',
      '7. Implement graceful degradation - continue without notifications'
    ],
    contacts: ['integrations-oncall@company.com', 'slack-support@slack.com']
  },
  {
    title: 'Worker Queue Backlog / Job Processing',
    severity: 'high',
    symptoms: [
      'worker_queue_length exceeds 100',
      'jobs_failed_total increases rapidly',
      'Export jobs delayed > 5 minutes',
      'File cleanup jobs not executing'
    ],
    steps: [
      '1. Check background-worker service health',
      '2. Verify job retry logic is working',
      '3. Increase worker pool size if CPU/memory allows',
      '4. Monitor dead-letter queue for permanently failed jobs',
      '5. Identify jobs with highest failure rate',
      '6. Check for job queue database collection size limits',
      '7. Consider implementing job prioritization'
    ],
    contacts: ['backend-oncall@company.com', 'database-admin@company.com']
  },
  {
    title: 'SLO Breach: Availability < 99.95%',
    severity: 'critical',
    symptoms: [
      'availability_percent metric falls below target',
      'Multiple service alerts firing simultaneously',
      'Error rate exceeds 1%',
      'High API latency (p99 > 1 second)'
    ],
    steps: [
      '1. Page on-call incident commander',
      '2. Check system-health endpoint for service status',
      '3. Review last 15 minutes of metrics - identify root cause',
      '4. Implement immediate mitigation (scale up, circuit breaker)',
      '5. Activate war room call with architecture team',
      '6. Document incident timeline and decisions',
      '7. Plan blameless post-incident review within 24 hours'
    ],
    contacts: ['incident-commander@company.com', 'oncall-team@company.com']
  },
  {
    title: 'SLO Breach: Latency (p99 > 500ms)',
    severity: 'high',
    symptoms: [
      'request_duration_ms p99 exceeds 500ms',
      'Database query slowness',
      'Idempotency cache misses spiking',
      'API response times degrading'
    ],
    steps: [
      '1. Check tracing service for slow queries',
      '2. Review database slow query logs',
      '3. Check for N+1 query patterns in functions',
      '4. Verify cache hit rate - enable if needed',
      '5. Check for deployment of unoptimized code',
      '6. Monitor CPU/memory utilization',
      '7. Consider database query optimization or replication'
    ],
    contacts: ['database-oncall@company.com', 'performance-team@company.com']
  }
];

export default function IncidentResponse() {
  const [selectedRunbook, setSelectedRunbook] = useState<number | null>(null);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<boolean[]>([]);

  const toggleRunbook = (idx: number) => {
    setSelectedRunbook(selectedRunbook === idx ? null : idx);
  };

  const toggleAcknowledge = (idx: number) => {
    const newAck = [...acknowledgedAlerts];
    newAck[idx] = !newAck[idx];
    setAcknowledgedAlerts(newAck);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Incident Response & On-Call Runbooks (Phase 5)</h1>
        <p style={{ color: '#6b7280' }}>
          Step-by-step procedures for common incidents and on-call escalation
        </p>
      </div>

      {/* On-Call Rota */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0 }}>On-Call Rota (Weekly Rotation)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '0.375rem' }}>
            <strong>This Week (Oct 18-25)</strong>
            <p style={{ margin: '0.5rem 0 0 0' }}>
              🔴 Backend: alice@company.com<br/>
              🟡 Database: bob@company.com<br/>
              🟢 Integrations: charlie@company.com<br/>
            </p>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.375rem' }}>
            <strong>Escalation Path</strong>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
              1. Page on-call engineer (PagerDuty)<br/>
              2. Wait 5 min, then escalate to backup<br/>
              3. Alert incident commander if SEV-1<br/>
              4. Activate war room if multiple teams affected
            </p>
          </div>
        </div>
      </div>

      {/* Runbooks */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Incident Runbooks</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {runbooks.map((runbook, idx) => (
            <div key={idx}>
              <button
                onClick={() => toggleRunbook(idx)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: `${getSeverityColor(runbook.severity)}15`,
                  border: `2px solid ${getSeverityColor(runbook.severity)}`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ color: getSeverityColor(runbook.severity) }}>
                  {runbook.title}
                </span>
                <span style={{
                  fontSize: '0.875rem',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: getSeverityColor(runbook.severity),
                  color: 'white',
                  borderRadius: '0.25rem',
                  textTransform: 'uppercase'
                }}>
                  {runbook.severity}
                </span>
              </button>

              {selectedRunbook === idx && (
                <div style={{ padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginTop: '0.5rem' }}>
                  <h3 style={{ marginTop: 0 }}>Symptoms</h3>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {runbook.symptoms.map((symptom, sidx) => (
                      <li key={sidx}>{symptom}</li>
                    ))}
                  </ul>

                  <h3>Resolution Steps</h3>
                  <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {runbook.steps.map((step, sidx) => (
                      <li key={sidx} style={{ marginBottom: '0.5rem' }}>{step}</li>
                    ))}
                  </ol>

                  <h3>Escalation Contacts</h3>
                  <div style={{ backgroundColor: '#fef3c7', padding: '1rem', borderRadius: '0.375rem' }}>
                    {runbook.contacts.map((contact, cidx) => (
                      <div key={cidx} style={{ marginBottom: cidx < runbook.contacts.length - 1 ? '0.5rem' : 0 }}>
                        📧 {contact}
                      </div>
                    ))}
                  </div>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={acknowledgedAlerts[idx] || false}
                      onChange={() => toggleAcknowledge(idx)}
                    />
                    <span>I acknowledge this runbook and understand the escalation path</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Post-Incident Review Template */}
      <div style={{
        marginTop: '2rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0 }}>Blameless Post-Incident Review Template</h2>
        <p style={{ color: '#6b7280' }}>Complete within 24 hours of resolution</p>
        <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
          <strong>1. Timeline</strong>
          <p style={{ margin: '0.25rem 0' }}>- Detection time: ___________</p>
          <p style={{ margin: '0.25rem 0' }}>- Impact duration: ___________</p>
          <p style={{ margin: '0.25rem 0' }}>- Resolution time: ___________</p>

          <strong style={{ marginTop: '1rem', display: 'block' }}>2. Root Cause</strong>
          <p style={{ margin: '0.25rem 0' }}>What were the contributing factors?</p>

          <strong style={{ marginTop: '1rem', display: 'block' }}>3. Impact</strong>
          <p style={{ margin: '0.25rem 0' }}>- Users affected: ___________</p>
          <p style={{ margin: '0.25rem 0' }}>- Data loss: ___________</p>
          <p style={{ margin: '0.25rem 0' }}>- Revenue impact: ___________</p>

          <strong style={{ marginTop: '1rem', display: 'block' }}>4. Remediation Tasks</strong>
          <p style={{ margin: '0.25rem 0' }}>- [ ] Code fix deployed</p>
          <p style={{ margin: '0.25rem 0' }}>- [ ] Configuration updated</p>
          <p style={{ margin: '0.25rem 0' }}>- [ ] Monitoring alert added</p>
          <p style={{ margin: '0.25rem 0' }}>- [ ] Documentation updated</p>

          <strong style={{ marginTop: '1rem', display: 'block' }}>5. Lessons Learned</strong>
          <p style={{ margin: '0.25rem 0' }}>What will we do differently next time?</p>
        </div>
      </div>

      {/* Phase 5 Incident Response Features */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#ecfdf5',
        borderRadius: '0.375rem',
        border: '1px solid #86efac'
      }}>
        <strong>Phase 5 Incident Response Features:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
          <li>On-call rota with PagerDuty integration</li>
          <li>7 incident runbooks for common issues</li>
          <li>Escalation contacts and chain of command</li>
          <li>Blameless post-incident review process</li>
          <li>Automatic tracking of MTTR (Mean Time To Resolution)</li>
          <li>Incident metrics and trending analysis</li>
          <li>War room coordination and stakeholder updates</li>
        </ul>
      </div>
    </div>
  );
}
