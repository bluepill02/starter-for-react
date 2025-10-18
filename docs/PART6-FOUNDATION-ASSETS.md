# Part 6: Foundation Assets & Existing Code

**Purpose:** Quick inventory of what's built and available to extend for Part 6 implementation

---

## ACCESSIBILITY & LOCALIZATION - BUILT CODE

### Location: `/apps/web/src/lib/i18n.ts`
**Status:** ✅ Production-ready
**What it does:**
- Tamil-first language detection (auto-detects based on browser/timezone)
- React hook: `useI18n(key, vars?)`
- Standalone function: `translate(key, vars?)`
- localStorage persistence
- Automatic English fallback
- Variable interpolation (`{{variable}}` syntax)

**How to extend:**
```typescript
// Add more languages by updating:
type Locale = 'en' | 'ta' | 'kn' | 'te' | 'ml'; // Add Kannada, Telugu, Malayalam

const translations: Record<Locale, Translations> = {
  en: enTranslations,
  ta: taTranslations,
  kn: knTranslations, // NEW
  te: teTranslations, // NEW
  ml: mlTranslations, // NEW
};

function detectTamilLocale(): boolean {
  // Update to detect other South Indian languages
  // Based on browser language, timezone, saved preference
}
```

### Location: `/i18n/ta.json` & `/i18n/en.json`
**Status:** ✅ ~120 keys in each
**What's translated:**
- Recognition module (give, view, tags)
- Upload/evidence
- Validation messages
- Profile/verification
- Admin/HR functions
- Privacy settings
- Common UI strings

**How to extend:**
```json
// Add new sections for onboarding, pricing, commercial
{
  "onboarding": {
    "welcome": "வருக",
    "step1": "உங்கள் குழுவை உருவாக்கவும்",
    "step2": "உறுப்பினர்களை வரவேற்கவும்",
    "step3": "முதல் அங்கீகாரத்தை அளிக்கவும்"
  },
  "pricing": {
    "free": "இலவசம்",
    "team": "குழு",
    "enterprise": "நிறுவன"
  }
}
```

### Location: `/apps/web/src/components/LanguageSwitcher.tsx`
**Status:** ✅ Demo working
**Component code:**
```tsx
export function LanguageSwitcher(): ReactElement {
  const currentLocale = getCurrentLocale();
  const handleLocaleChange = (locale: 'en' | 'ta') => {
    setLocale(locale);
  };
  
  return (
    // Button group to switch languages
    // Shows current locale + available options
  );
}
```

### Location: `/src/App.css` & Component files
**Status:** ✅ Accessibility already implemented
**What's there:**
- WCAG focus styles (3px outline, offset 2px)
- Skip links (`.skip-link:focus`)
- High contrast mode support
- Print styles
- ARIA live regions
- Focus management

**Components with accessibility:**
- RecognitionModal.tsx: ARIA labels, focus trap, live region for status
- ManagerVerification.tsx: ARIA announcements, role attributes
- RecognitionCard: Semantic HTML, proper heading hierarchy
- Form inputs: aria-describedby, aria-invalid, aria-required

---

## MANAGER & HR WORKFLOWS - BUILT CODE

### Location: `/apps/web/src/components/ManagerVerification.tsx`
**Status:** ✅ Production-ready (575+ lines)
**What it does:**
- Lists pending recognitions requiring verification
- Approve/Reject/Request Info actions
- Required notes for reject/info
- Real-time updates
- ARIA announcements
- Permission checks (isManager/isAdmin)

**Key functions:**
```typescript
loadPendingRecognitions() // Fetch from DB
handleVerification(action: 'APPROVE'|'REJECT'|'REQUEST_INFO')
executeVerification() // Call API
```

**How to extend for Bulk Operations:**
```typescript
// Add to existing component:
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const handleBulkApprove = async () => {
  // Call new bulk-verify function
  for (const id of selectedIds) {
    await executeVerification(id, 'APPROVE');
  }
  setSelectedIds(new Set());
};

// Add checkboxes to recognition cards for selection
```

### Location: `/apps/web/src/components/HRExportSystem.tsx`
**Status:** ✅ Production-ready (200+ lines)
**What it does:**
- Individual/Team/Department/Org export
- PDF and CSV formats
- Date range filtering
- Anonymization toggle
- Async processing
- Export history tracking
- Permission enforcement

**Key functions:**
```typescript
handleExport() // Submit export request
```

**How to extend:**
```typescript
// Add advanced filtering:
const [filters, setFilters] = useState({
  minWeight: 0,
  tags: [],
  verifiedOnly: false,
  showMetrics: false,
});

// Add bulk PDF generation with watermarks
// Add email delivery option
// Add scheduled exports

// For HR compliance tools, add:
// - GDPR right-to-access requests
// - Right-to-erasure workflows
// - Consent audit logs
```

### Location: `/apps/api/functions/export-profile/index.ts`
**Status:** ✅ Production-ready (400+ lines)
**What it does:**
- Server-side PDF generation
- Presigned URLs (24hr TTL)
- Hashed IDs for privacy
- Verifier stamps
- CSV export
- Private data filtering
- Audit trail creation

**Key functions:**
```typescript
async function handler(req, res) {
  // Generate PDF or CSV
  // Create presigned URL
  // Log to audit trail
  // Return download link
}

function generatePDFHTML() // HTML for PDF
function generateCSVContent() // CSV data
```

**How to extend:**
```typescript
// Add batch processing
async function generateBatchPDFs(userIds: string[]) {
  // Generate multiple PDFs
  // Return zip file
}

// Add digital signatures
function addDigitalSignature(pdfPath: string) {
  // Sign with company certificate
}

// Add watermarks
// Add custom branding
// Add email delivery
```

### Location: `/apps/web/src/components/ProfilePage.tsx`
**Status:** ✅ 80% complete
**What it does:**
- Shows user profile
- Recognition history (given/received)
- Analytics tabs (skeleton)
- Export buttons
- Stats display

**What's missing:**
- Shareable link generation
- Portfolio export
- View counter
- Share button implementation

**How to extend:**
```typescript
// Add shareable profile:
const [shareLink, setShareLink] = useState<string>('');

const generateShareLink = async () => {
  const link = await createPresignedProfileLink(userId, {
    utmSource: 'profile-share',
    utmCampaign: 'recognition-sharing'
  });
  setShareLink(link);
};

// Add social media cards (OG tags)
// Add view counter
// Add portfolio PDF generation
```

### Location: `/docs/hr-integration.md`
**Status:** ✅ 380+ lines of documentation
**What's documented:**
- Export formats (PDF, CSV)
- Privacy levels
- Bulk API endpoints
- SCIM integration
- GDPR compliance
- Audit trails
- Sample exports

**How to extend:**
- Add pricing tier documentation
- Add DPA/contract sections
- Add compliance checklists
- Add implementation guides

---

## FIRST RUN & ONBOARDING - PARTIAL

### Location: `/apps/api/functions/bootstrap-seed/index.ts`
**Status:** ✅ Seed data system working
**What it does:**
- Creates 6 test users (admin, managers, employees)
- Creates 3 sample teams
- Creates 5 sample recognitions
- Seeds deterministic test data

**How to extend for Starter Pack:**
```typescript
// Add recognition templates
const starterPackRecognitions = [
  {
    title: "Great Teamwork",
    reason: "Collaborated effectively on project X",
    tags: ["teamwork", "collaboration"],
    template: true
  },
  // ... more templates
];

// Add suggested tags
const suggestedTags = [
  "teamwork", "leadership", "innovation", 
  "communication", "quality", "reliability"
];
```

### Location: `/docs/dev-run-checklist.md`
**Status:** ✅ Setup documentation
**What's there:**
- Step-by-step emulator setup
- Seed data commands
- Expected outputs
- Quick start guide

**How to extend:**
- Add "First User Onboarding" section
- Add "Integration Setup" section
- Add troubleshooting guide

### Location: `/scripts/start-emulator.sh`
**Status:** ✅ Emulator setup
**What it does:**
- Starts Appwrite emulator
- Creates project and database
- Sets up collections
- Creates storage bucket

---

## GROWTH & VIRALITY - NOT BUILT

### Location: `/apps/web/src/components/ProfilePage.tsx` (to extend)
**What exists:**
```tsx
// Placeholder share button
<button onClick={() => console.log('Share')}>Share Profile</button>
```

**What to build:**
```typescript
// 1. Shareable link generation
async function generateShareLink() {
  const token = await createProfileToken(userId, 24); // 24hr expiry
  return `${APP_URL}/profile/${userId}/public?token=${token}&utm_source=share`;
}

// 2. Social media cards (add to meta tags)
<meta property="og:title" content="Check out my recognition profile!" />
<meta property="og:description" content={profileSummary} />
<meta property="og:image" content={previewImage} />

// 3. Weekly digest email
// Create /apps/api/functions/send-weekly-digest/index.ts

// 4. Portfolio export
// Extend /apps/api/functions/export-profile/index.ts

// 5. Viral mechanics
// Create /apps/api/functions/track-share/index.ts
```

### Missing Infrastructure:
- Share tracking database collection
- UTM parameter handling
- Email template system (for digests)
- Scheduled job system (for weekly digests)
- View counter collection
- Portfolio PDF templates

---

## COMMERCIAL READINESS - NOT BUILT

### Location: `/src/App.jsx`
**What exists:**
- Landing page with value prop
- Feature cards
- "GDPR compliant" callout

**What to build:**
```tsx
// 1. Pricing page
<Route path="/pricing" element={<PricingPage />} />

// 2. Signup flow (free tier)
<Route path="/signup" element={<SignupFlow />} />

// 3. Enterprise contact form
// /apps/web/src/components/EnterpriseContactForm.tsx

// 4. ROI calculator (interactive)
// /apps/web/src/components/ROICalculator.tsx
```

### Missing Files:
```
/pages/pricing.tsx           # Pricing page
/pages/signup.tsx            # Free tier signup
/components/SignupFlow.tsx   # Onboarding wizard
/components/PricingCard.tsx  # Tier card component
/components/ROICalculator.tsx
/docs/pricing-tiers.md       # Tier definitions
/docs/sales-playbook.md      # Sales materials
/docs/dpa-template.md        # Data Processing Addendum
/docs/terms-of-service.md    # Legal docs
```

---

## Code Reuse Strategy

### For Accessibility
Extend existing components rather than rebuild:
- `LanguageSwitcher.tsx` - Add new languages
- Form inputs - Add new ARIA patterns
- Components - Already have WCAG basics

### For HR/Manager Workflows
Extend existing functions:
- `ManagerVerification.tsx` - Add bulk selection
- `HRExportSystem.tsx` - Add advanced filters
- `export-profile/index.ts` - Add batch processing
- `/docs/hr-integration.md` - Add compliance sections

### For Onboarding
Extend seed data:
- `bootstrap-seed/index.ts` - Add recognition templates
- `dev-run-checklist.md` - Add onboarding guide

### For Virality
Create new components (no conflicts):
- `ShareProfile.tsx` - New component
- `WeeklyDigest.tsx` - New component
- `ProfilePortfolio.tsx` - New component

### For Commercial
Create new pages (no conflicts):
- `PricingPage.tsx` - New component
- `SignupFlow.tsx` - New component
- `EnterpriseContactForm.tsx` - New component

---

## Files Ready to Reference

When implementing Part 6, reference these as templates:

1. **Component Structure:**
   - RecognitionModal.tsx (modal + form + validation)
   - ManagerVerification.tsx (list + actions + state)
   - HRExportSystem.tsx (multi-step form + async)

2. **API Functions:**
   - export-profile/index.ts (server-side rendering, auth, audit)
   - scim-sync/index.ts (bulk operations, error handling)

3. **Styling & Accessibility:**
   - App.css (WCAG, dark mode, responsive)
   - RecognitionModal.tsx (ARIA, keyboard nav, modals)

4. **i18n:**
   - i18n.ts (language detection, persistence)
   - en.json & ta.json (translation structure)

5. **Tests:**
   - evidenceUpload.test.js (ARIA testing)
   - system.test.ts (RBAC testing)

6. **Documentation:**
   - hr-integration.md (export formats, compliance)
   - dev-run-checklist.md (step-by-step guides)

---

## Action Items for Part 6

1. **Review** existing code in `/apps/web/src/components/` and `/apps/web/src/lib/`
2. **Identify** reusable patterns (forms, API calls, state management)
3. **Extend** existing components where possible
4. **Create** new components only for truly new functionality
5. **Reference** this document when planning architecture

---

**Created:** October 18, 2025  
**Scope:** Part 6 Foundation Analysis  
**Status:** Ready for implementation planning
