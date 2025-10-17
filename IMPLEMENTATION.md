# Recognition App - Appwrite Client, Schema, and i18n System

This implementation provides the foundational infrastructure for a recognition app built on Appwrite with React, following the specifications in the copilot instructions.

## 🏗️ Architecture Overview

The codebase follows a monorepo structure with clear separation of concerns:

```
starter-for-react/
├── apps/web/                    # React frontend application
│   └── src/
│       ├── appwrite/
│       │   └── client.ts        # Appwrite client wrapper
│       ├── lib/
│       │   └── i18n.ts          # Internationalization system
│       └── components/
│           └── LanguageSwitcher.tsx  # Demo component
├── packages/
│   ├── schema/                  # Shared Zod schemas and types
│   │   └── src/types.ts
│   └── tests/                   # Test suite
│       ├── schema.types.test.ts
│       └── i18n.test.ts
└── i18n/                       # Translation files
    ├── en.json                  # English translations
    └── ta.json                  # Tamil translations
```

## 📦 Components Implemented

### 1. Appwrite Client Wrapper (`/apps/web/src/appwrite/client.ts`)

**Features:**
- ✅ Configured Appwrite client reading environment variables
- ✅ Export helpers: `getAccount()`, `getDatabase()`, `getStorage()`, `getFunctions()`, `getLocale()`
- ✅ Type-safe environment variable handling
- ✅ Client-side security (no API keys on frontend)

**Environment Variables Required:**
```bash
VITE_APPWRITE_ENDPOINT=https://your-appwrite-endpoint/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
```

**Usage:**
```typescript
import { getAccount, getDatabase, getStorage } from '@/appwrite/client';

const account = getAccount();
const databases = getDatabase();
const storage = getStorage();
```

### 2. Shared Schema (`/packages/schema/src/types.ts`)

**Features:**
- ✅ Zod validation schemas with runtime type checking
- ✅ Exported TypeScript types for frontend/backend
- ✅ Recognition workflow schemas
- ✅ Audit trail schemas
- ✅ User management schemas

**Key Schemas:**
- `CreateRecognitionSchema` - Validates new recognition creation
- `RecognitionSchema` - Full recognition with metadata
- `UserSchema` - User profiles with RBAC roles
- `AuditEntrySchema` - Audit trail for compliance
- `ExportProfileSchema` - HR-grade export configurations

**Usage:**
```typescript
import { CreateRecognitionSchema, type Recognition } from '@recognition/schema';

// Runtime validation
const validatedData = CreateRecognitionSchema.parse(formData);

// Type safety
const recognition: Recognition = await api.getRecognition(id);
```

### 3. Internationalization System (`/apps/web/src/lib/i18n.ts`)

**Features:**
- ✅ Tamil-first locale detection with intelligent fallbacks
- ✅ React hook: `useI18n(key, vars?)` for components
- ✅ Standalone function: `translate(key, vars?)` for utilities
- ✅ Variable interpolation with `{{variable}}` syntax
- ✅ Nested key support: `'recognize.button'`, `'validation.minLength'`
- ✅ Automatic fallback to English when translations missing
- ✅ Persistent locale preference in localStorage

**Tamil-First Detection Logic:**
1. Browser language contains 'ta' or 'TN'
2. Timezone is 'Asia/Kolkata' or 'Asia/Calcutta'
3. Saved preference in localStorage
4. Fallback to English

**Usage:**
```typescript
import { useI18n, setLocale } from '@/lib/i18n';

function RecognitionButton() {
  const buttonText = useI18n('recognize.button');
  const errorText = useI18n('validation.minLength', { min: '20' });
  
  return <button>{buttonText}</button>;
}

// Change language globally
setLocale('ta'); // Switch to Tamil
setLocale('en'); // Switch to English
```

### 4. Translation Files

**English (`/i18n/en.json`):**
```json
{
  "recognize": {
    "button": "Give Recognition",
    "title": "Recognize Someone"
  },
  "privacy": {
    "private": "Only you and the recipient can see this",
    "team": "Your team can see this recognition",
    "public": "Everyone in the organization can see this"
  }
}
```

**Tamil (`/i18n/ta.json`):**
```json
{
  "recognize": {
    "button": "அங்கீகாரம் அளிக்கவும்",
    "title": "யாரையாவது அங்கீகரிக்கவும்"
  }
}
```

## 🧪 Test Suite

### Schema Tests (`/packages/tests/schema.types.test.ts`)
- ✅ Validates all Zod schemas with edge cases
- ✅ Tests default values and optional fields
- ✅ Validates recognition visibility levels
- ✅ Tests audit entry event codes
- ✅ Export profile validation with anonymization

### i18n Tests (`/packages/tests/i18n.test.ts`)
- ✅ Locale detection heuristics
- ✅ String interpolation with variables
- ✅ Nested key path resolution
- ✅ Fallback behavior (Tamil → English → Key)
- ✅ Locale persistence in localStorage

**Run Tests:**
```bash
npm test                # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## 🚀 Usage Examples

### Recognition Creation Flow
```typescript
import { CreateRecognitionSchema } from '@recognition/schema';
import { getDatabase } from '@/appwrite/client';
import { useI18n } from '@/lib/i18n';

function RecognitionForm() {
  const submitText = useI18n('common.submit');
  const validationError = useI18n('validation.required');
  
  const handleSubmit = async (formData: unknown) => {
    try {
      // Runtime validation with Zod
      const validatedData = CreateRecognitionSchema.parse(formData);
      
      // Save to Appwrite
      const databases = getDatabase();
      await databases.createDocument('recognition', validatedData);
      
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };
}
```

### Language Switching
```typescript
import { setLocale, getCurrentLocale } from '@/lib/i18n';

function LanguageToggle() {
  const currentLang = getCurrentLocale();
  
  const toggleLanguage = () => {
    setLocale(currentLang === 'en' ? 'ta' : 'en');
  };
  
  return (
    <button onClick={toggleLanguage}>
      {currentLang === 'en' ? 'தமிழ்' : 'English'}
    </button>
  );
}
```

## 🔒 Security & Privacy Features

### Client-Side Security
- ✅ No API keys exposed on frontend
- ✅ Environment variable validation
- ✅ Type-safe configuration

### Privacy-First Design
- ✅ Recognition visibility controls (PRIVATE/TEAM/PUBLIC)
- ✅ Audit trail for compliance
- ✅ Anonymization options for HR exports
- ✅ Hashed IDs in audit entries

### Anti-Abuse Foundations
- ✅ Schema validation prevents malformed data
- ✅ Weight system for recognition value
- ✅ Audit events for abuse detection pipeline

## 📊 Production Readiness

### Type Safety
- ✅ Strict TypeScript configuration
- ✅ Runtime validation with Zod
- ✅ Shared types between frontend/backend

### Testing Coverage
- ✅ Unit tests for all schemas
- ✅ i18n system comprehensive testing
- ✅ Edge case validation
- ✅ Mock setup for browser APIs

### Scalability
- ✅ Monorepo structure for growth
- ✅ Modular package architecture
- ✅ Extensible translation system
- ✅ Framework-agnostic schemas

## 🎯 Next Steps

This implementation provides the foundation for:

1. **Authentication System** - Extend with OAuth providers (Google, Microsoft)
2. **Recognition UI Components** - Build on schema and i18n foundation
3. **Evidence Upload System** - Integrate with Appwrite Storage
4. **Manager Verification Workflow** - Use audit trail and RBAC
5. **HR Export Pipeline** - Leverage export schemas
6. **Slack/Teams Integrations** - Reuse validation and audit system
7. **Anti-Abuse Detection** - Build on audit events and weight system

The architecture ensures these features can be added incrementally while maintaining type safety, testability, and internationalization support.