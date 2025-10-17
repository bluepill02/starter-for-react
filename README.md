# Recognition App - React + Appwrite

A secure, evidence-first recognition platform built on React and Appwrite, featuring Tamil-first localization, anti-abuse detection, and enterprise-grade security.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Appwrite Cloud account or self-hosted instance
- Storage bucket configured for file uploads

### Quick Setup
```bash
git clone https://github.com/appwrite/starter-for-react
cd starter-for-react
npm install
```

## 🛠️ Development Setup

### 1. Appwrite Configuration
Create `.env.local` files based on the examples:

**Web App** (`/apps/web/.env.local`):
```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_BUCKET_ID=evidence-storage
VITE_APPWRITE_DATABASE_ID=main-db
```

**API Functions** (`/apps/api/.env.local`):
```env
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-server-api-key
APPWRITE_BUCKET_ID=evidence-storage
APPWRITE_DATABASE_ID=main-db
```

### 2. Appwrite Resources Setup

Create these collections in your database:
- `recognitions` - Core recognition data
- `recognition_audits` - Audit trail for all operations
- `evidence_previews` - File preview and security metadata
- `users_extended` - Additional user profile data

Create storage bucket with these permissions:
- Read: `role:member` (authenticated users)
- Create: `role:member`
- Update: `role:admin`
- Delete: `role:admin`

### 3. Required Appwrite Functions

Deploy these server-side functions:
- **presign-upload** - Secure upload authorization and audit logging
- **evidence-preview** - Thumbnail generation and content security scanning
- **create-recognition** - Recognition creation with abuse detection
- **verify-recognition** - Manager verification workflow

### 4. Install Dependencies & Run

```bash
# Install all workspace dependencies
npm install

# Start development servers
npm run dev

# Run tests
npm run test

# Run E2E tests (requires Appwrite setup)
npm run test:e2e
```

## 🔒 Security Features

### Evidence Upload Security
- **Zod Validation** - Runtime schema validation for all uploads
- **Content Scanning** - Automatic security flag detection
- **Size Limits** - 50MB max per file with type restrictions
- **Presigned Uploads** - Server-authorized upload tokens prevent abuse
- **Audit Trail** - Complete logging of all upload operations

### Privacy-First Design
- **Private by Default** - All recognitions default to private visibility
- **Hashed Identifiers** - No PII in logs or telemetry
- **Short-lived Previews** - Evidence served via temporary URLs only
- **Role-based Access** - Manager verification requirements with RBAC

### Anti-Abuse Protection
- **Rate Limiting** - 10 recognitions per day per user (configurable)
- **Reciprocity Detection** - Automatic flagging of suspicious patterns
- **Content Analysis** - Evidence weight adjustments based on quality
- **Manual Review** - Admin override capability with required justification

## 🌐 Internationalization

### Tamil-First Localization
The app prioritizes Tamil language support:

```javascript
// Usage in components
import { useI18n } from '../lib/i18n';

function MyComponent() {
  const { t } = useI18n();
  return <h1>{t('recognition.title')}</h1>;
}
```

Language files:
- `/i18n/ta.json` - Tamil (primary)
- `/i18n/en.json` - English (fallback)

### Adding New Translations
1. Add keys to both language files
2. Use descriptive key paths: `feature.component.element`
3. Include context for translators in comments

## 🧪 Testing

### Unit Tests
```bash
npm run test                    # All unit tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report
```

### End-to-End Tests
```bash
npm run test:e2e              # Full E2E suite
npm run test:e2e:headed       # With browser UI
```

Test files structure:
- `/packages/tests/*.test.js` - Unit tests
- `/packages/tests/e2e/*.spec.js` - E2E tests

### Appwrite Emulator Testing
```bash
# Start local Appwrite for testing
npm run test:setup
npm run test:e2e:local
```

## 📊 Monitoring & Analytics

### Audit Trail
All operations create audit entries:
- Recognition creation/verification
- Evidence uploads/access
- Admin actions and overrides
- Integration activities (Slack/Teams)

### Telemetry
Privacy-compliant metrics:
- Hashed user IDs only
- No content or PII logging
- Aggregate usage patterns
- Performance monitoring

## 🔧 Architecture

### Monorepo Structure
```
/apps/web/          # React frontend (Vite)
/apps/api/          # Appwrite Functions
/packages/schema/   # Shared Zod types
/packages/tests/    # Test suites
/i18n/             # Localization files
/infra/            # Deployment configs
```

### Key Components
- **Evidence Upload System** - Secure file handling with preview generation
- **Recognition Modal** - Accessible form with real-time validation
- **Admin Dashboard** - Abuse monitoring and override capabilities
- **Export System** - PDF/CSV generation with privacy controls

### Data Flow
1. User uploads evidence → Presign validation → Secure storage
2. Recognition creation → Abuse detection → Manager notification
3. Verification process → Weight calculation → Audit logging
4. Export request → Server-side rendering → Temporary download

## 🚀 Deployment

### Environment Setup
```bash
# Production environment variables
APPWRITE_ENDPOINT=your-production-endpoint
APPWRITE_PROJECT_ID=prod-project-id
APPWRITE_API_KEY=prod-server-key
```

### Build & Deploy
```bash
npm run build                  # Build all apps
npm run deploy                 # Deploy to production
```

### Health Checks
- `/api/health` - Server status
- Storage bucket connectivity
- Database schema validation
- Function deployment status

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feat/amazing-feature`
5. Open Pull Request

### Development Workflow
- Use Conventional Commits
- Add tests for new features
- Update documentation
- Ensure TypeScript compliance
- Test accessibility features

## 📚 Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [React + Appwrite Guide](https://appwrite.io/docs/tutorials/react)
- [Storage API Reference](https://appwrite.io/docs/client/storage)
- [Functions Documentation](https://appwrite.io/docs/functions)
- [Security Best Practices](https://appwrite.io/docs/security)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.