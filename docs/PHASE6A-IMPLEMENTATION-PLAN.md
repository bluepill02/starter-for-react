# Phase 6A: Essential UX Implementation Plan

**Duration:** 2 weeks (80 hours)  
**Goal:** Improve activation & compliance for existing users  
**Status:** Ready to Start

---

## 5 Deliverables

### 1️⃣ WCAG Audit & Accessibility Fixes (10 hours)
**File:** `/apps/web/src/App.css` + component tests  
**What to build:**
- Run axe-core audit on all components
- Fix color contrast issues (WCAG AA minimum)
- Enhance focus indicators (3px, visible on all interactive elements)
- Add error message ARIA labels
- Test keyboard navigation on all forms

**Checklist:**
- [ ] Install axe-core: `npm install --save-dev @axe-core/react`
- [ ] Run audit on all components
- [ ] Fix 5-10 contrast violations in App.css
- [ ] Add missing aria-label attributes
- [ ] Create `/packages/tests/accessibility.test.tsx` (5 test cases)
- [ ] Document fixed issues in PHASE6A-IMPLEMENTATION.md

**Key patterns to fix:**
```css
/* Enhance focus indicators */
button:focus,
input:focus,
a:focus {
  outline: 3px solid var(--focus-color);
  outline-offset: 2px;
}

/* Ensure color contrast (WCAG AA) */
/* Text: 4.5:1, Large text: 3:1, UI components: 3:1 */
```

---

### 2️⃣ Manager Onboarding Checklist (20 hours)
**File:** `/apps/web/src/components/ManagerChecklist.tsx`  
**What to build:**

Create an interactive checklist component that guides new managers through setup:

```
Step 1: Create Team ✓
├─ Team name & description
└─ Click "Next" when ready

Step 2: Add Team Members ✓
├─ Search & invite by email
└─ Wait for acceptance

Step 3: Send Welcome Email ✓
├─ Customize message
└─ Send to all members

Step 4: Review First Recognition ✓
├─ Approve/Reject sample
└─ Complete setup
```

**Component structure:**
```typescript
interface ManagerChecklistProps {
  userId: string;
  onComplete: () => void;
}

interface ChecklistStep {
  id: string;
  title: string;  // i18n key
  description: string;  // i18n key
  isComplete: boolean;
  action?: () => Promise<void>;
  icon: 'create' | 'users' | 'email' | 'verify';
}

export function ManagerChecklist(props: ManagerChecklistProps) {
  const [steps, setSteps] = useState<ChecklistStep[]>([
    {
      id: 'create-team',
      title: 'checklist.createTeam',
      description: 'checklist.createTeamDesc',
      isComplete: false,
      icon: 'create'
    },
    // ... 3 more steps
  ]);
  
  const handleComplete = async (stepId: string) => {
    // Mark step complete
    // Show success toast
    // Progress to next
  };
}
```

**What it needs:**
- Progress bar showing 0-4 steps complete
- Step cards with icon, title, description
- Action buttons (e.g., "Create Team", "Add Members")
- Checkmark animation on completion
- Skip option (with warning)
- i18n keys: checklist.*, checklist.step1, checklist.step2, etc.
- Storage in `recognition:onboarding:manager` localStorage key
- Desktop-only (hide on mobile)

**Accessibility requirements:**
- `role="progressbar"` with aria-valuenow, aria-valuemin, aria-valuemax
- Each step has `role="listitem"`
- Buttons have clear labels
- Keyboard navigation (Tab, Enter, Space)
- Live region announces step completion

**Where to show:**
- Show on ManagerDashboard.tsx after first login
- Hide after completion
- Option to dismiss (don't show again)

**Tests to add:**
- Render all steps
- Click each action button
- Verify localStorage persistence
- Test keyboard navigation
- Test ARIA attributes

---

### 3️⃣ Recognition Starter Pack (15 hours)
**File:** `/apps/web/src/components/RecognitionTemplates.tsx`  
**What to build:**

Pre-filled recognition templates to help new users write their first recognition:

```
Template Gallery:
┌─────────────────────────────┐
│ Teamwork                 👥 │
│ "Great collaboration      │
│  on Project X"            │
│ Tags: teamwork, project   │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Leadership                ⭐ │
│ "Took initiative and      │
│  guided the team"         │
│ Tags: leadership, mentor  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Innovation                💡 │
│ "Suggested process       │
│  improvement"             │
│ Tags: innovation, process │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Communication             🗣 │
│ "Clear & effective       │
│  communication"           │
│ Tags: communication, skills│
└─────────────────────────────┘
```

**Component structure:**
```typescript
interface RecognitionTemplate {
  id: string;
  icon: string;
  titleKey: string;  // Template name i18n key
  descriptionKey: string;  // Template body i18n key
  suggestedTags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const templates: RecognitionTemplate[] = [
  {
    id: 'teamwork',
    icon: '👥',
    titleKey: 'templates.teamwork',
    descriptionKey: 'templates.teamworkDesc',
    suggestedTags: ['teamwork', 'collaboration'],
    difficulty: 'beginner'
  },
  // ... more templates
];

export function RecognitionTemplates({
  onSelect: (template: RecognitionTemplate) => void
}) {
  const handleSelectTemplate = (template: RecognitionTemplate) => {
    // Pre-fill RecognitionModal with template
    // User can edit before sending
  };
}
```

**What it needs:**
- Gallery view with 4-6 template cards
- Click to pre-fill RecognitionModal
- Edit before sending (modal opens with template data)
- Show "beginner-friendly" badge for easy templates
- Difficulty indicator (⭐ | ⭐⭐ | ⭐⭐⭐)
- i18n keys: templates.teamwork, templates.leadership, etc.
- Icons (emoji or Lucide)

**Where to show:**
- Show on first recognition creation
- Show as "Use a template" option in RecognitionModal
- Optional: Show in feed/profile as inspiration

**Data to add:**
```typescript
// In bootstrap-seed/index.ts, add templates data:
const starterPackTemplates = [
  {
    category: 'teamwork',
    examples: [
      'Great collaboration on Project X',
      'Worked effectively with design team',
      'Helped team member when they needed support'
    ]
  },
  // ... more categories
];
```

**Tests to add:**
- Render all templates
- Click template to pre-fill modal
- Verify data transferred correctly
- Test difficulty filter (if added)
- Test i18n translation

---

### 4️⃣ Shareable Profile Links (Basic) (15 hours)
**File:** `/apps/web/src/components/ProfilePage.tsx` (extend)  
**What to build:**

Add share functionality to user profiles:

```
User Profile:
┌─────────────────────────┐
│ Jane Doe                │
│ 📊 Received: 24         │
│ 🎖️ Impact Score: 8.5   │
│                         │
│ [📤 Share Profile]      │
│ [📥 Export Portfolio]   │
│                         │
│ ✓ Verification: 18/24   │
└─────────────────────────┘

Share options:
- Copy Link (to clipboard)
- Email Link
- Download Profile Card (PNG)
```

**What to add to ProfilePage.tsx:**
```typescript
const handleShareProfile = async () => {
  // Generate presigned share token (24hr TTL)
  const token = await createProfileShareToken(userId);
  
  // Create UTM-tracked URL
  const shareUrl = new URL(`${APP_URL}/profile/${userId}/public`);
  shareUrl.searchParams.set('token', token);
  shareUrl.searchParams.set('utm_source', 'profile_share');
  shareUrl.searchParams.set('utm_campaign', 'recognition_viral');
  
  // Copy to clipboard or email
  navigator.clipboard.writeText(shareUrl.toString());
};

// Add new API function: /apps/api/functions/create-profile-share/index.ts
async function createProfileShareToken(userId: string) {
  const token = generateSecureToken();
  await db.collection('ProfileShares').create({
    userId,
    token,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    views: 0
  });
  return token;
}
```

**Share UI:**
- Button "Share Profile" with icon
- Modal with options:
  - Copy link button (shows "Copied!" confirmation)
  - Email button (pre-filled with link)
  - Download card (PNG preview)
- Show view count if profile was shared

**What it tracks (for viral metrics):**
- Share source (email, copy, social)
- Click-throughs (when public link visited)
- Views on profile (counter increments)

**Public profile page:**
```typescript
// NEW: /apps/web/src/pages/profile/[userId]/public.tsx
export function PublicProfilePage({ userId, token }) {
  // Verify token is valid & not expired
  // Show public recognition summary
  // Don't show private data
  // Track view (increment counter)
  
  return (
    <div>
      <h1>{user.name}'s Recognition Profile</h1>
      <p>{user.recognitionsReceived.length} recognitions received</p>
      <p>Impact Score: {user.impactScore}</p>
      
      {/* Show sample recognitions (verified only, no private details) */}
      {user.recognitionsReceived.slice(0, 5).map(rec => (
        <RecognitionCard key={rec.id} recognition={rec} />
      ))}
      
      <p><strong>View this on {APP_NAME}</strong></p>
    </div>
  );
}
```

**API endpoint:**
```typescript
// POST /api/functions/create-profile-share
// Input: { userId: string }
// Output: { shareToken: string, expiresAt: timestamp }

// GET /api/functions/verify-profile-share
// Input: { userId: string, token: string }
// Output: { isValid: boolean, expiresAt: timestamp }
```

**Tests to add:**
- Generate share token
- Verify token validity
- Check token expiration
- Track share count
- Test public profile page
- Test UTM parameters in URL

---

### 5️⃣ Bulk Verification UI (20 hours)
**File:** `/apps/web/src/components/ManagerVerification.tsx` (extend)  
**What to build:**

Add multi-select capability to manager verification:

```
Manager Verification Dashboard:

[☐ Select All] [Clear]

┌──────────────────────────────┐
│ ☐ Jane → John: Great work!   │
│ ☐ Tom → Jane: Leadership     │
│ ☐ Bob → Tom: Innovation      │
│ ☐ Alice → Bob: Communication │
│ ☐ Carol → Alice: Teamwork    │
└──────────────────────────────┘

Selected: 3
[👍 Approve All] [👎 Reject All]
```

**What to add to ManagerVerification.tsx:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkAction, setBulkAction] = useState<'APPROVE' | 'REJECT' | null>(null);

const handleSelectAll = () => {
  if (selectedIds.size === recognitions.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(recognitions.map(r => r.id)));
  }
};

const handleToggleSelect = (id: string) => {
  const newSet = new Set(selectedIds);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  setSelectedIds(newSet);
};

const handleBulkApprove = async () => {
  // Verify notes required (if needed)
  // Make parallel API calls
  // Show progress bar
  // Show success toast
  
  const results = await Promise.all(
    Array.from(selectedIds).map(id =>
      verifyRecognition(id, 'APPROVE', '')
    )
  );
  
  setSelectedIds(new Set());
  reloadRecognitions();
};
```

**UI elements to add:**
- Checkboxes for each recognition
- "Select All" checkbox in header
- Counter showing "Selected: X / Y"
- Bulk action buttons: "Approve All", "Reject All"
- Disable buttons if nothing selected
- Loading spinner during bulk operation
- Progress indicator (X / Y approved)
- Rollback on error (show which ones failed)

**Bulk verification API:**
```typescript
// POST /api/functions/bulk-verify-recognition
// Input: {
//   recognitionIds: string[],
//   action: 'APPROVE' | 'REJECT',
//   notes?: string  // Optional, for REJECT
// }
// Output: {
//   successful: string[],
//   failed: { id: string, error: string }[],
//   timestamp: timestamp
// }

async function bulkVerifyRecognitions(
  recognitionIds: string[],
  action: 'APPROVE' | 'REJECT',
  notes?: string
) {
  const results = {
    successful: [],
    failed: []
  };
  
  for (const id of recognitionIds) {
    try {
      await verifyRecognition(id, action, notes);
      results.successful.push(id);
      
      // Create audit entry
      await createAuditEntry({
        eventCode: `recognition_${action.toLowerCase()}`,
        actor: currentUserId,
        target: id,
        details: { bulk: true }
      });
    } catch (error) {
      results.failed.push({ id, error: error.message });
    }
  }
  
  return results;
}
```

**Keyboard accessibility:**
- Tab through checkboxes
- Space to toggle
- Ctrl+A for "Select All"
- Enter to trigger bulk action

**Tests to add:**
- Select single item
- Select all items
- Deselect items
- Bulk approve (success)
- Bulk reject (with notes)
- Partial failure (some succeed, some fail)
- Rollback on error
- Clear selection
- Keyboard navigation

---

## Implementation Order

**Week 1:**
1. **Day 1-2:** WCAG Audit & Accessibility Fixes (10h)
2. **Day 3-4:** Manager Onboarding Checklist (20h)

**Week 2:**
3. **Day 5:** Recognition Starter Pack (15h)
4. **Day 6:** Shareable Profile Links (15h)
5. **Day 7:** Bulk Verification UI (20h)

**Week 2 continued:**
6. **Day 8:** Comprehensive Testing (20h)
7. **Day 9:** Documentation & i18n (10h)

---

## i18n Keys to Add

**Add to `/i18n/en.json` and `/i18n/ta.json`:**

```json
{
  "accessibility": {
    "wcagCompliant": "WCAG 2.1 AA Compliant",
    "focusIndicator": "Focus indicator"
  },
  "checklist": {
    "managerSetup": "Manager Setup Checklist",
    "step1": "Create Your Team",
    "step1Desc": "Set up your team with a name and description",
    "step2": "Add Team Members",
    "step2Desc": "Invite your team members by email",
    "step3": "Send Welcome",
    "step3Desc": "Send a welcome message to your team",
    "step4": "Review Recognition",
    "step4Desc": "Approve or reject the first recognition",
    "markComplete": "Mark Complete",
    "skip": "Skip",
    "allStepsComplete": "Setup Complete! 🎉"
  },
  "templates": {
    "useTemplate": "Use a Template",
    "teamwork": "Teamwork",
    "teamworkDesc": "Great collaboration on [project/task]",
    "leadership": "Leadership",
    "leadershipDesc": "Took initiative and guided the team",
    "innovation": "Innovation",
    "innovationDesc": "Suggested process improvement or creative solution",
    "communication": "Communication",
    "communicationDesc": "Clear and effective communication",
    "reliability": "Reliability",
    "reliabilityDesc": "Consistently delivers quality work",
    "support": "Support",
    "supportDesc": "Helped team member when they needed assistance"
  },
  "sharing": {
    "shareProfile": "Share Profile",
    "shareUrl": "Share URL",
    "copyLink": "Copy Link",
    "emailLink": "Email Link",
    "downloadCard": "Download Card",
    "copied": "Copied to clipboard!",
    "views": "Profile Views",
    "publicProfile": "Public Recognition Profile"
  },
  "verification": {
    "selectAll": "Select All",
    "clearAll": "Clear All",
    "selected": "Selected {{count}} / {{total}}",
    "bulkApprove": "Approve All",
    "bulkReject": "Reject All",
    "processing": "Processing {{current}} / {{total}}...",
    "bulkSuccess": "✓ {{count}} recognitions approved"
  }
}
```

---

## File Structure After Phase 6A

```
/apps/web/src/
├── components/
│   ├── ManagerChecklist.tsx         (NEW - 200 lines)
│   ├── RecognitionTemplates.tsx     (NEW - 150 lines)
│   ├── ManagerVerification.tsx      (EXTEND - +100 lines for bulk)
│   └── ProfilePage.tsx              (EXTEND - +50 lines for share)
├── pages/
│   └── profile/
│       └── [userId]/
│           └── public.tsx           (NEW - 120 lines)
├── lib/
│   └── i18n.ts                      (EXTEND - add new keys)
├── App.css                          (EXTEND - +30 lines for accessibility)
│
/apps/api/functions/
├── create-profile-share/
│   └── index.ts                     (NEW - 100 lines)
├── verify-profile-share/
│   └── index.ts                     (NEW - 80 lines)
└── bulk-verify-recognition/
    └── index.ts                     (NEW - 150 lines)

/i18n/
├── en.json                          (EXTEND - +50 keys)
└── ta.json                          (EXTEND - +50 keys)

/packages/tests/
├── ManagerChecklist.test.tsx        (NEW - 100 lines)
├── RecognitionTemplates.test.tsx    (NEW - 80 lines)
├── accessibility.test.tsx           (NEW - 70 lines)
└── ManagerBulkVerify.test.tsx       (NEW - 120 lines)

/packages/tests/e2e/
├── manager-checklist.spec.ts        (NEW - 90 lines)
└── bulk-verification.spec.ts        (NEW - 100 lines)

/docs/
└── PHASE6A-IMPLEMENTATION.md        (NEW - 300+ lines with code examples)
```

---

## Testing Strategy

**Jest Unit Tests (300+ lines):**
- ManagerChecklist component (10 tests)
- RecognitionTemplates component (8 tests)
- Accessibility utilities (5 tests)
- Bulk verification logic (10 tests)
- Share token generation (6 tests)

**Playwright E2E Tests (250+ lines):**
- Manager completes checklist flow (1 test)
- Create recognition from template (1 test)
- Share profile and verify public view (1 test)
- Bulk approve recognitions (1 test)

**Accessibility Tests (axe-core):**
- All components pass WCAG AA
- Focus management works
- ARIA labels present
- Color contrast 4.5:1

---

## Success Criteria

✅ **After Phase 6A is complete:**
1. All components WCAG AA compliant
2. New managers can complete 4-step checklist
3. New users can use recognition templates
4. Any user can share their profile with 24hr token
5. Managers can bulk-verify 10+ recognitions
6. 95%+ test coverage across new components
7. All i18n keys translated to Tamil
8. 0 accessibility violations in axe-core audit

---

## Next: Phase 6B Plan

After 6A, you'll have:
- Strong UX for new users (checklist)
- Faster recognition creation (templates)
- Viral sharing (profile links + share tracking)
- Better manager experience (bulk operations)

Then Phase 6B (Growth Engine) will add:
- Weekly digest emails
- Viral mechanics & leaderboards
- Portfolio export
- View counting & engagement tracking

---

**Ready to start?** 

I'll begin with **Task 1: WCAG Audit & Accessibility Fixes** — let me scan the codebase and identify issues to fix.
