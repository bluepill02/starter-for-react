# Phase 6A Deployment Guide

## Pre-Deployment Checklist

### Code Review
- [ ] All components reviewed for quality
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript strict mode passing (`npm run typecheck`)
- [ ] All tests passing locally (`npm test`)

### Testing
- [ ] Unit tests passing: 75+ test cases
- [ ] E2E tests passing: 12+ Playwright scenarios
- [ ] Accessibility audit passed
- [ ] Dark mode tested on all components
- [ ] Mobile responsive verified (320px, 768px, 1024px)
- [ ] Keyboard navigation verified (Tab, Enter, Escape)
- [ ] Screen reader testing with NVDA/JAWS

### Database Migrations
- [ ] Create `ProfileShares` collection:
  ```
  {
    $id: string (unique),
    userId: string (indexed),
    token: string (unique, indexed),
    createdAt: string (ISO timestamp),
    expiresAt: string (ISO timestamp),
    views: number,
    shareSource: string,
    utmSource: string,
    utmCampaign: string,
    status: string (enum: active, expired, revoked)
  }
  ```
- [ ] Create `RecognitionAudit` collection (if not exists):
  ```
  {
    $id: string,
    eventCode: string (indexed),
    actor: string (indexed, hashed),
    target: string (indexed, hashed),
    details: object,
    timestamp: string (ISO, indexed),
    ipAddress: string (hashed),
    userAgent: string
  }
  ```
- [ ] Add indexes for queries: userId, token, eventCode, timestamp

### i18n Integration
- [ ] Merge `en-phase-6a.json` into `i18n/en.json`
- [ ] Merge `ta-phase-6a.json` into `i18n/ta.json`
- [ ] Test language switching
- [ ] Verify no duplicate keys

### Environment Variables
- [ ] All required vars set in `.env.production`:
  ```
  APPWRITE_ENDPOINT=
  APPWRITE_PROJECT_ID=
  APPWRITE_DATABASE_ID=
  APPWRITE_API_KEY=
  APPWRITE_STORAGE_ID=
  APP_URL=https://recognition.example.com
  ```

---

## Deployment Process

### Stage 1: Staging Deployment (1 hour)

1. **Merge to staging branch**
   ```bash
   git checkout staging
   git merge phase-6a --no-ff
   git push origin staging
   ```

2. **Run full test suite**
   ```bash
   npm install
   npm run lint
   npm run typecheck
   npm test
   npm run test:e2e
   ```

3. **Deploy to staging environment**
   ```bash
   # Using your deployment tool (CI/CD)
   # e.g., GitHub Actions, GitLab CI, Jenkins
   ```

4. **Database migrations on staging**
   ```bash
   npm run migrate:staging
   ```

5. **Smoke tests on staging**
   - [ ] Manager onboarding flow works
   - [ ] Create recognition with template
   - [ ] Share profile generates token
   - [ ] Shared profile accessible
   - [ ] Bulk verification modal functions
   - [ ] All ARIA labels announced
   - [ ] Dark mode renders correctly

6. **Performance testing**
   ```bash
   npm run perf:test
   ```

### Stage 2: QA Testing (2 hours)

1. **Manual testing checklist**
   - [ ] Complete manager onboarding (all 4 steps)
   - [ ] Test template selection (all 6 templates)
   - [ ] Create recognition with template data
   - [ ] Share profile via copy link
   - [ ] Share profile via email
   - [ ] Access shared profile with token
   - [ ] Test expired token error
   - [ ] Select and approve multiple recognitions
   - [ ] Select and reject multiple recognitions
   - [ ] Search recognitions on dashboard
   - [ ] Filter by status on dashboard

2. **Accessibility testing**
   - [ ] NVDA/JAWS screen reader testing
   - [ ] Keyboard-only navigation
   - [ ] Tab order verification
   - [ ] Focus indicator visibility
   - [ ] Color contrast (aXe tool)
   - [ ] ARIA labels completeness

3. **Browser testing**
   - [ ] Chrome (latest)
   - [ ] Firefox (latest)
   - [ ] Safari (latest)
   - [ ] Edge (latest)

4. **Device testing**
   - [ ] iPhone 12/13 (375px)
   - [ ] iPad (768px)
   - [ ] Desktop (1024px+)
   - [ ] Touch screen interactions
   - [ ] Landscape/portrait orientation

### Stage 3: Production Rollout (30 mins)

1. **Backup production database**
   ```bash
   npm run backup:prod
   ```

2. **Tag production release**
   ```bash
   git tag -a v6.0.0-alpha.1 -m "Phase 6A: Essential UX"
   git push origin v6.0.0-alpha.1
   ```

3. **Merge to main branch**
   ```bash
   git checkout main
   git merge staging --no-ff
   git push origin main
   ```

4. **Deploy to production**
   ```bash
   npm run deploy:prod
   ```

5. **Run production smoke tests**
   - [ ] All manager flows work
   - [ ] API endpoints responding
   - [ ] Database connections healthy
   - [ ] i18n properly loaded

6. **Monitor production metrics**
   - [ ] Error rate stable
   - [ ] Response times normal
   - [ ] No critical alerts
   - [ ] User feedback positive

---

## Rollback Plan

If issues occur during production deployment:

1. **Immediate rollback (< 5 mins)**
   ```bash
   git revert HEAD
   npm run deploy:prod
   ```

2. **Database rollback (if needed)**
   ```bash
   npm run restore:prod <backup_id>
   ```

3. **Notify stakeholders**
   - Send status update to team
   - Create incident ticket
   - Schedule postmortem

4. **Root cause analysis**
   - Check logs for errors
   - Review recent changes
   - Identify fix needed
   - Implement fix on staging

---

## Post-Deployment Validation (1 hour)

### Automated Checks
- [ ] All E2E tests passing on production
- [ ] Uptime monitor reporting 100%
- [ ] Error rate below threshold
- [ ] Performance metrics normal
- [ ] API response times stable

### Manual Verification
- [ ] Create test recognition via web UI
- [ ] Generate share link
- [ ] Verify shared profile loads
- [ ] Test manager dashboard
- [ ] Test bulk verification
- [ ] Verify translations work

### Analytics
- [ ] Onboarding step tracking enabled
- [ ] Template selection tracked
- [ ] Share generation logged
- [ ] Verification actions logged
- [ ] No tracking errors

### User Communication
- [ ] Release notes published
- [ ] In-app announcement (if applicable)
- [ ] Email to early adopters
- [ ] Documentation updated
- [ ] Support team briefed

---

## Production Monitoring (Ongoing)

### Key Metrics to Track
- **Manager Onboarding**
  - Step 1-4 completion rate
  - Average time to complete
  - Skip rate
  - Conversion to first recognition

- **Recognition Creation**
  - Templates used (which ones)
  - Recognition creation rate
  - Average weight assigned
  - Tags usage

- **Profile Sharing**
  - Share tokens generated
  - Token expiration vs use rate
  - View count per share
  - Referral source tracking (UTM)

- **Bulk Verification**
  - Items verified per session
  - Approval vs rejection rate
  - Time to verify
  - Error rate

### Alerts to Configure
- [ ] Error rate > 1% for 5 mins
- [ ] API response time > 2s
- [ ] Database connection failures
- [ ] Failed share token generation
- [ ] Failed bulk verification
- [ ] Excessive failed login attempts

### Weekly Review
- [ ] Feature adoption metrics
- [ ] User feedback sentiment
- [ ] Bug reports trend
- [ ] Performance trend
- [ ] Cost impact (if applicable)

---

## Troubleshooting

### Manager Onboarding Not Loading
1. Check browser console for errors
2. Verify localStorage permissions
3. Clear browser cache and retry
4. Check network requests in DevTools

### Share Token Generation Failing
1. Verify Appwrite connectivity
2. Check ProfileShares collection exists
3. Verify API key permissions
4. Check database quota

### Bulk Verification Hanging
1. Check RecognitionAudit collection exists
2. Verify batch operation limits
3. Check for database locks
4. Review error logs

### i18n Keys Not Loading
1. Verify JSON files merged correctly
2. Check for duplicate keys
3. Verify useI18n hook working
4. Check language preference setting

---

## Support Contacts

- **Deployment Issues**: DevOps team
- **Database Issues**: Database admin
- **Feature Questions**: Product team
- **Accessibility Issues**: A11y specialist
- **User Support**: Support team

---

## Sign-Off

- [ ] QA Lead: Approved for production
- [ ] Product Manager: Feature complete
- [ ] DevOps Lead: Infrastructure ready
- [ ] Security: Security review passed
- [ ] Accessibility: A11y audit passed

---

**Deployment Date**: [Date]
**Deployed By**: [Name]
**Version**: v6.0.0-alpha.1
**Duration**: ~2 hours (staging → production)

---

## Post-Deployment Support (24 hours)

Keep team on standby for 24 hours after deployment:
- [ ] Monitor error rates
- [ ] Respond to user reports
- [ ] Document any issues
- [ ] Prepare fixes if needed
- [ ] Post-deployment retrospective (2 days after)
