# Security Compliance Requirements - Implementation Mapping

**Document:** Security, Privacy & Compliance (Part 2 of 6)  
**Status:** Implementation Plan Created  
**Date:** October 18, 2025

---

## Requirement Mapping

### A. Authentication and RBAC

#### Requirement
> SSO OIDC and SAML with domain based provisioning and optional SCIM user sync.
> Enforce roles: user, manager, admin, HR, auditor via middleware.

#### Current Implementation Status
```
✅ OIDC (OAuth 2.0)
   - Google OAuth: apps/web/src/lib/auth.tsx
   - Microsoft OAuth: apps/web/src/lib/auth.tsx
   - Provider callbacks: apps/web/src/pages/auth/callback.tsx

⚠️ SAML
   - Not yet implemented (enterprise optional)
   - Can use Appwrite built-in SAML provider

⚠️ Domain-based provisioning
   - Not yet implemented
   - Needs: apps/api/functions/auth/auto-provision-user/index.ts

⚠️ SCIM user sync
   - Not yet implemented (enterprise optional)
   - Needs: apps/api/functions/scim-sync/index.ts

⚠️ Role enforcement middleware
   - Partial: Role helpers exist (isManager, isAdmin)
   - Needs: Middleware on every API endpoint
   - Needs: apps/api/functions/middleware/auth.js

✅ Roles defined
   - user, manager, admin in role system
   - TODO: Add HR and auditor roles
```

#### Implementation Plan
1. **Create RBAC Middleware** (1 day)
   - File: `apps/api/functions/middleware/auth.js`
   - Enforces roles on all endpoints
   - Prevents privilege escalation
   - Logs RBAC violations

2. **Add Domain Provisioning** (1 day)
   - File: `apps/api/functions/auth/auto-provision-user/index.ts`
   - Auto-create users from whitelisted domains
   - Assign roles based on email domain
   - Log provisioning events

3. **Add HR & Auditor Roles** (0.5 day)
   - Update schema in `packages/schema/src/types.ts`
   - Add role checks in functions

4. **SAML Support** (2 days - optional)
   - Use Appwrite built-in provider
   - Configure in Appwrite console

5. **SCIM Sync** (3 days - optional/enterprise)
   - File: `apps/api/functions/scim-sync/index.ts`
   - SCIM 2.0 endpoint

---

### B. Evidence Handling

#### Requirement
> Client presigned PUT uploads to private object store; server issues short TTL presigned GET for authorized preview and download.
> No raw evidence in logs; never store presign secrets in source.

#### Current Implementation Status
```
⚠️ Presigned PUT uploads
   - Function exists: apps/api/functions/presign-upload/index.js
   - Needs: Proper validation and timeout (15 min)
   - Needs: Security headers (origin check, referer check)
   - Needs: File type/size validation

⚠️ Presigned GET for download
   - Not yet implemented
   - Needs: apps/api/functions/presign-download/index.js
   - Should enforce: Authorization checks, 5 min TTL

✅ Storage bucket private
   - Evidence bucket configured as private

✅ No raw evidence in logs
   - Audit logger hashes evidence IDs
   - Never logs raw file content

✅ No presign secrets in source
   - Uses environment variables
   - Secrets not in code
```

#### Implementation Plan
1. **Enhance Presigned Upload** (1 day)
   - File: `apps/api/functions/presign-upload/index.js`
   - Add file validation (type, size)
   - Add origin/referer validation
   - Set TTL to 15 minutes
   - Log upload request to audit trail

2. **Create Presigned Download** (1 day)
   - File: `apps/api/functions/presign-download/index.js`
   - Verify user can access evidence
   - Verify recognition is not deleted
   - Issue 5-min presigned URL
   - Log download access

3. **Update Client Upload** (1 day)
   - File: `apps/web/src/lib/useEvidenceUpload.ts`
   - Call presign-upload first
   - Upload to presigned URL
   - Verify upload success

---

### C. Data Protection

#### Requirement
> TLS everywhere; encryption at rest; hashed IDs used in telemetry and exports; configurable data retention and residency options.

#### Current Implementation Status
```
✅ TLS everywhere
   - Appwrite enforces HTTPS
   - Frontend must use HTTPS in production

✅ Encryption at rest
   - Storage bucket: Enabled
   - Database: Appwrite handles

⚠️ Hashed IDs in telemetry
   - Partial: hashUserId exists in audit-logger.js
   - Needs: Verify all telemetry uses hashing
   - File: apps/api/functions/services/audit-logger.js

⚠️ Configurable data retention
   - Not yet implemented
   - Needs: apps/api/functions/services/data-retention.js
   - Environment variables for retention periods

⚠️ Data residency options
   - Not yet implemented
   - Appwrite only supports single region
   - Can document recommended regions
```

#### Implementation Plan
1. **Data Retention Service** (2 days)
   - File: `apps/api/functions/services/data-retention.js`
   - Config variables:
     - RETENTION_RECOGNITION_DAYS=365
     - RETENTION_AUDIT_DAYS=2555 (7 years)
     - RETENTION_TELEMETRY_DAYS=90
   - Auto-delete expired data
   - Archive compliance data before delete
   - Audit all deletions

2. **Verify Telemetry Hashing** (0.5 day)
   - Audit telemetry-events collection
   - Verify hashedUserId used everywhere
   - Never log raw emails or names

3. **Data Residency Documentation** (0.5 day)
   - Document Appwrite region selection
   - Provide region selection guide
   - Document data sovereignty considerations

---

### D. Auditability

#### Requirement
> Append only RecognitionAudit entries for create update verify export integration and admin actions; admin overrides require justification and mandatory audit entry.

#### Current Implementation Status
```
✅ RecognitionAudit service
   - File: apps/api/functions/services/audit-logger.js
   - 15+ event codes defined
   - Append-only implementation
   - 7-year retention by default

✅ Audit events for:
   - create (RECOGNITION_CREATED)
   - update (RECOGNITION_VERIFIED)
   - verify (RECOGNITION_VERIFIED)
   - export (EXPORT_REQUESTED)
   - integration (via event codes)

⚠️ Admin overrides
   - Not yet implemented
   - Needs: Justification requirement
   - Needs: apps/api/functions/admin/override-recognition/index.ts
   - Needs: apps/web/src/pages/admin/overrides.tsx

✅ Admin action auditing
   - ADMIN_ACTION event code exists
```

#### Implementation Plan
1. **Admin Override Function** (2 days)
   - File: `apps/api/functions/admin/override-recognition/index.ts`
   - Require justification (min 20 chars)
   - Validate override reason
   - Add fields to recognition:
     - overrideJustification
     - overriddenBy
     - overrideTimestamp
   - Create ADMIN_OVERRIDE audit entry
   - Notify affected user

2. **Admin Override UI** (1 day)
   - File: `apps/web/src/pages/admin/overrides.tsx`
   - Show pending overrides
   - Show justification form
   - Display audit history

3. **Enhanced Audit Logging** (0.5 day)
   - Add new event codes:
     - ADMIN_OVERRIDE_SUCCESS
     - ADMIN_OVERRIDE_DENIED
     - EVIDENCE_DELETED
     - DATA_RETENTION_TRIGGERED

4. **Audit Trail Export** (2 days)
   - File: `apps/api/functions/admin/export-audit-trail/index.ts`
   - File: `apps/web/src/pages/admin/audit-export.tsx`
   - Export formats: CSV, JSON, PDF
   - Filter by date, event code, user
   - Digital signature for compliance

---

### E. Secrets Management

#### Requirement
> Use managed secret stores; rotate keys; CI secrets scanning; no secrets in repos.

#### Current Implementation Status
```
✅ No secrets in repos
   - .env.development.example template only
   - All secrets in environment variables

✅ Environment variables used
   - APPWRITE_KEY
   - SLACK_SIGNING_SECRET
   - etc.

⚠️ Managed secret stores
   - Not yet implemented
   - Can integrate: AWS Secrets Manager, Vault, etc.

⚠️ Key rotation
   - Not documented
   - Needs: Rotation policy and procedure

⚠️ CI secrets scanning
   - Not yet implemented
   - Needs: truffleHog or git-secrets
```

#### Implementation Plan
1. **CI Secrets Scanning** (1 day)
   - Add to GitHub Actions workflow
   - Tools: truffleHog, detect-secrets
   - Fail CI if secrets detected

2. **Managed Secrets Integration** (2 days)
   - Option 1: AWS Secrets Manager (recommended)
   - Option 2: HashiCorp Vault
   - Create abstraction layer
   - File: `apps/api/functions/services/secrets-manager.js`

3. **Key Rotation Documentation** (1 day)
   - Rotation schedule
   - Rotation procedures
   - Pre/post-rotation checklist
   - File: `docs/KEY-ROTATION-POLICY.md`

---

### F. Compliance Controls

#### Requirement
> Exportable audit trail; PII stripping mode for HR exports; published data use and retention policy; email and sharing opt outs.

#### Current Implementation Status
```
⚠️ Exportable audit trail
   - Not yet implemented
   - Needs: apps/api/functions/admin/export-audit-trail/index.ts

⚠️ PII stripping for HR exports
   - Not yet implemented
   - Needs: apps/api/functions/export/csv-hr-safe/index.ts
   - Need to anonymize: emails, names, IPs

⚠️ Data use and retention policy
   - Not yet documented
   - Needs: docs/DATA-USE-POLICY.md
   - Needs: docs/RETENTION-POLICY.md

⚠️ Email and sharing opt-outs
   - Not yet implemented
   - Needs: emailOptIn, shareOptIn fields in users
   - Needs: apps/api/functions/user/update-preferences/index.ts
   - Needs: apps/web/src/pages/settings/privacy.tsx
```

#### Implementation Plan
1. **PII Stripping for HR Export** (2 days)
   - File: `apps/api/functions/export/csv-hr-safe/index.ts`
   - Remove: emails, names, IP addresses
   - Use: hashed IDs instead
   - Include: recognition data, counts, weights
   - Removable fields: user names (can be referenced by ID)

2. **Email & Sharing Opt-Outs** (2 days)
   - Update users collection schema:
     - emailOptIn (boolean, default true)
     - shareOptIn (boolean, default true)
   - File: `apps/api/functions/user/update-preferences/index.ts`
   - File: `apps/web/src/pages/settings/privacy.tsx`
   - Check opt-ins before sending emails
   - Check opt-ins before sharing data

3. **Data Policies** (1 day)
   - File: `docs/DATA-USE-POLICY.md`
     - What data we collect
     - How we use data
     - Who has access
     - Data subject rights
   - File: `docs/RETENTION-POLICY.md`
     - Recognition data: 1 year default
     - Audit data: 7 years minimum
     - Telemetry: 90 days default
   - Add links to public site

---

## Priority Implementation Order

### Phase 1: Critical (Do First)
1. RBAC middleware enforcement
2. Presigned upload/download with validation
3. Admin override with justification
4. Data retention service
5. PII stripping for exports

**Effort:** 1.5 weeks  
**Impact:** Enables all compliance requirements

### Phase 2: Important (Do Next)
1. Email & sharing opt-outs
2. Audit trail export
3. Data use policies
4. Domain-based provisioning
5. Enhanced telemetry hashing

**Effort:** 1 week  
**Impact:** Compliance and user control

### Phase 3: Optional (Enterprise)
1. SAML support
2. SCIM sync
3. Secrets manager integration
4. Key rotation procedures
5. Advanced data residency

**Effort:** 2 weeks  
**Impact:** Enterprise compliance

---

## Files to Create/Modify

### Create New Files
```
apps/api/functions/
├── middleware/auth.js (NEW)
├── services/
│   ├── data-retention.js (NEW)
│   └── secrets-manager.js (NEW)
├── auth/auto-provision-user/index.ts (NEW)
├── admin/
│   ├── override-recognition/index.ts (NEW)
│   └── export-audit-trail/index.ts (NEW)
└── export/csv-hr-safe/index.ts (NEW)

apps/web/src/
├── lib/presigned-download.ts (NEW)
├── pages/
│   ├── admin/
│   │   ├── overrides.tsx (NEW)
│   │   └── audit-export.tsx (NEW)
│   └── settings/privacy.tsx (NEW)

docs/
├── DATA-USE-POLICY.md (NEW)
├── RETENTION-POLICY.md (NEW)
└── KEY-ROTATION-POLICY.md (NEW)
```

### Modify Existing Files
```
apps/api/functions/
├── presign-upload/index.js (ENHANCE)
└── services/audit-logger.js (ENHANCE)

apps/web/src/
├── lib/auth.tsx (ENHANCE)
└── lib/useEvidenceUpload.ts (ENHANCE)

packages/schema/src/types.ts (ENHANCE - add roles)

.github/workflows/
└── dev-ci.yml (ADD secrets scanning)
```

---

## Testing Strategy

### Unit Tests
- RBAC middleware tests
- Data retention rules tests
- PII stripping verification
- Presigned URL generation tests

### Integration Tests
- End-to-end upload flow
- End-to-end download flow
- Admin override flow with audit
- Export with PII stripping

### Compliance Tests
- Audit entries created for all events
- No secrets leaked in logs
- No PII in non-HR exports
- Opt-outs honored

---

## Documentation to Create

1. **RBAC Implementation Guide**
   - How to add new roles
   - How to enforce roles on endpoints
   - Role hierarchy

2. **Evidence Upload Guide**
   - Client-side upload flow
   - Presigned URL generation
   - Error handling

3. **Compliance Guide**
   - Privacy controls
   - Data retention
   - Audit trail access
   - Export procedures

4. **Security Hardening**
   - Secrets management
   - Key rotation
   - Certificate management
   - Incident response

---

## Success Criteria

- [ ] All endpoints validate user roles
- [ ] Evidence handled via presigned URLs
- [ ] Admin overrides require justification
- [ ] Audit trail append-only and exportable
- [ ] Data retention policies enforced
- [ ] PII stripping works in exports
- [ ] Email/sharing opt-outs honored
- [ ] No secrets in logs
- [ ] All tests passing
- [ ] Compliance checklist 100%

---

**Next Steps:** Prioritize Phase 1 items and begin implementation  
**Timeline:** 4 weeks for all items, 1.5 weeks for critical path  
**Owner:** Security & Compliance team
