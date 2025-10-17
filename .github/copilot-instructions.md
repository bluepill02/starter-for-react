
# Copilot Instructions
Before creating any file, scan the repository for existing implementations and helpers to extend instead of duplicating.
- Search paths: /apps/web/src/appwrite/, /apps/api/functions/, /packages/schema/, /apps/web/src/lib/*, /apps/api/src/*, any file importing "appwrite".
- If matching code exists, extend it in-place and add tests. If missing, create files at the exact paths referenced in subsequent prompts.
- Fail early: if scan finds ambiguous overlapping implementations, produce a short report listing files to be merged and exit.
- REMEMBER TO CREATE THE APP FOR PRODUCTION DEPLOYMENT AND NOT JUST LOCAL DEV.
## Purpose
Provide precise, repository-aware instructions so Copilot produces code, tests, UI copy, and infra changes that match the Recognition app built on an Appwrite React starter template and the product goals: evidence-first recognition, private-first UX, Tamil-first localization, anti-abuse fairness, manager verification, HR-grade exports, integrations (Slack/Teams), auditability, and enterprise security.

---

## Repository layout and authoritative paths
- **Monorepo top-level**
  - /apps/web/ — React + TypeScript + Tailwind; Next.js app (app router).
  - /apps/api/ — Appwrite Functions and server-side utilities.
  - /packages/schema/ — Zod schemas and shared TypeScript types.
  - /packages/tests/ — Jest unit tests and Playwright E2E tests.
  - /i18n/ — /i18n/en.json and /i18n/ta.json.
  - /infra/ — deployment manifests, k8s, and migration scripts.
  - /docs/ — onboarding, dev-run-checklist.md, integrations, HR guidance.
- Always create or update files at these exact paths when instructed.

---

## Tech stack, conventions, and style rules
- TypeScript strict mode across frontend, functions, and packages.
- Runtime validation with Zod; share schemas from /packages/schema/src/types.ts.
- UI: React + Next.js + Tailwind; components under /apps/web/src/components; pages under /apps/web/src/pages or /apps/web/src/app for app-router layouts.
- Appwrite SDK for auth, database, storage, functions; central wrapper at /apps/web/src/appwrite/client.ts.
- Tests: Jest in /packages/tests for unit; Playwright in /packages/tests/e2e for E2E smoke tests.
- Commits: Conventional Commits. Feature branches: feat/<short-desc>. PRs include changelog entry and tests.
- Accessibility: keyboard-first, ARIA labels, focus traps in modals, ARIA live regions for toasts and upload progress.
- i18n: use useI18n(key, vars) from /apps/web/src/lib/i18n.ts; add keys to both /i18n/en.json and /i18n/ta.json every time a UI string is added or changed.
- File uploads: client direct upload to Appwrite Storage or Appwrite presign flow; never proxy raw file through functions; store storageId and short-lived preview links only.
- Telemetry and logs: use hashed IDs only; never log PII or raw evidence content.

---

## Priority features and exact file targets
- Auth and RBAC
  - /apps/web/src/lib/auth.tsx — useAuth hook with Appwrite OAuth (Google, Microsoft), email fallback, role helpers (isManager, isAdmin).
  - /apps/api/functions/scim-sync/index.ts — SCIM sync function; write RecognitionAudit entries.
  - /apps/api/functions/rbac-middleware/index.ts — middleware used by functions to enforce roles.
- Evidence upload and preview
  - /apps/web/src/lib/useEvidenceUpload.ts — presign or direct upload, preview generation, progress ARIA announcements.
  - /apps/api/functions/presign-upload/index.ts — validate and return upload token/url; create RecognitionAudit upload_request.
  - /apps/api/functions/evidence-preview/index.ts — preview worker for thumbnails/snippets and manual-review flags.
- Core recognition
  - /apps/web/src/components/RecognitionModal.tsx — autosave draft, tags (max 3), reason validation, evidence field, privacy default PRIVATE, optimistic UI.
  - /apps/web/src/pages/feed.tsx — feed with infinite scroll, skeletons, optimistic append/rollback.
  - /apps/web/src/pages/profile/[userId].tsx — ProfileSummary with export/share.
  - /apps/api/functions/create-recognition/index.ts — Zod validation, anti-abuse check, compute weight, write to DB, create RecognitionAudit.
  - /apps/api/functions/verify-recognition/index.ts — manager verification, verificationNote, recalc weight, audit entry.
  - /apps/api/functions/export-profile/index.ts — server-side HTML->PDF generation, store private file, return presigned link; CSV export for HR (anonymized options).
- Integrations
  - /apps/api/functions/integrations/slack/index.ts — command and interactive handlers, Slack signature verification, audit entries.
  - /apps/api/functions/integrations/teams/index.ts — Teams JWT validation, compose handler, audit entries.
  - /docs/integrations.md — manifest examples and env vars.
- Anti-abuse and admin
  - /apps/api/functions/services/abuse.ts — reciprocity detector, weight adjustments, reason codes, flag pipeline.
  - /apps/web/src/pages/admin/abuse.tsx — admin UI to review/override flags with required justification that creates audit entries.
  - /apps/api/functions/admin/abuse-report/index.ts — admin report endpoint.

---

## Tests, CI, and dev-run obligations
- Unit tests required for every new/changed service or component under /packages/tests; tests must import shared types from /packages/schema.
- Playwright E2E smoke tests under /packages/tests/e2e must cover sign-in, give recognition (with upload), verify, and export flows.
- CI workflow: /apps/.github/workflows/dev-ci.yml runs install, lint, typecheck, Jest, Playwright (against Appwrite emulator container), and migration dry-run.
- Local dev orchestration:
  - /scripts/start-emulator.sh to launch Appwrite emulator.
  - /apps/api/.env.development.example and /apps/web/.env.development.example with required envs.
  - /apps/api/functions/bootstrap-seed/index.ts and /apps/web/src/lib/seed.ts to seed deterministic test data.
  - /docs/dev-run-checklist.md with exact copy-paste commands to start emulator, seed, and run dev servers.
- PRs must include updated changelog, README/dev-run changes, and at least one test demonstrating the change.

---

## Security, privacy, and operational constraints
- Never log raw evidence, emails, or PII. Use one-way hashed IDs in telemetry and exports.
- Evidence access: store preview metadata; serve evidence via short-lived presigned URLs only when authorized.
- Auditing: every recognition create/verify/export/integration/admin override must create a RecognitionAudit entry with event code and hashed identifiers.
- Secrets: require using managed secret store in production; .env.* examples only; CI must run secret scanning. Rotate integration keys periodically.
- Exports: PDF and CSV must include verifier stamp, timestamp, and hashed IDs; offer PII-stripped option for HR.
- Anti-abuse: enforce rate limits (default 10 recognitions/day/giver), reciprocity detection, and evidence-weight adjustments; flagged items require manual review by admin with recorded justification.

---

## How to prompt Copilot for code generation (examples)
- Component with tests:
  ```
  Create a React TypeScript component at /apps/web/src/components/RecognitionModal.tsx
  Requirements: Tailwind, accessible modal, autosave draft (localStorage key recognition:draft), fields: recipient, tags (max 3), reason (min 20 chars for evidence-weighted), evidence upload via /apps/web/src/lib/useEvidenceUpload.ts hook, visibility toggle default PRIVATE, ARIA live region for progress, keyboard accessible. Add unit tests at /packages/tests/RecognitionModal.test.tsx.
  ```
- Function with validation and audit:
  ```
  Create an Appwrite Function at /apps/api/functions/create-recognition/index.ts
  Requirements: Validate payload with Zod from /packages/schema/src/types.ts, run abuse.detectReciprocity, compute weight, write recognition to Appwrite Database, create RecognitionAudit entry, emit telemetry recognition_created (hashed IDs). Add unit tests at /packages/tests/recognition.api.test.ts mocking Appwrite Database and abuse service.
  ```
- Integration scaffold:
  ```
  Check for existing Slack integration under /apps/api/functions/integrations/slack. If missing, create /apps/api/functions/integrations/slack/index.ts with POST handlers for /command and /interactive, validate Slack signature (env SLACK_SIGNING_SECRET), and call create-recognition function. Add tests at /packages/tests/slack.integration.test.ts.
  ```

---
