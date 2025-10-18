# Development Conventions & Commands

## Code Style
- **Language**: TypeScript strict mode across all files
- **Naming**: camelCase for variables/functions, PascalCase for types/classes, UPPER_SNAKE_CASE for constants
- **Type Hints**: Full type annotations required, no `any` unless absolutely necessary
- **Docstrings**: JSDoc comments for public functions/types, inline comments for complex logic
- **Error Handling**: Try-catch with proper error logging, fail-safe patterns (don't fail main operation for side effects)
- **Privacy**: Hash user IDs with Buffer.from(userId).toString('base64').substring(0,16), never log PII
- **Validation**: Zod schemas for all request/response data, validate early in functions

## Key Commands
```bash
# Development
npm run dev                    # Start all services
npm run dev:emulator         # Start Appwrite emulator
npm run dev:api              # Start API functions
npm run dev:web              # Start React dev server
npm run dev:seed             # Seed test data

# Testing
npm test                     # Run Jest tests
npm test:watch              # Watch mode
npm test:coverage           # Coverage report
npm test:e2e                # Playwright E2E
npm test:smoke              # Smoke tests

# Quality
npm run lint                 # ESLint check
npm run format               # Prettier format
npm run format:check         # Check formatting
npm run type-check           # TypeScript check

# Build & Deploy
npm run build                # Build all
npm run build:web           # Build React
npm run build:api           # Build functions
```

## Appwrite Specifics
- **Collections**: recognitions, users, audit_entries, abuse_flags, telemetry_events
- **Storage**: evidence files stored in Appwrite Storage, presigned URLs for access
- **Functions**: Deploy at /apps/api/functions/{name}/index.ts
- **Environment**: Use process.env for secrets, store in .env.production

## Testing Pattern
1. Unit tests in /packages/tests for services and utils
2. E2E tests in /packages/tests/e2e for workflows
3. Mock Appwrite Database/Users/Functions in tests
4. Use deterministic test data (seed data)

## When Task Complete
1. Run `npm run lint` and fix all issues
2. Run `npm run type-check` and verify no errors
3. Run `npm test` and ensure new tests pass (add tests for new code!)
4. Run `npm run format` to ensure consistent formatting
5. Update CHANGELOG.md with feature description
6. Commit with conventional commit message: feat(scope): description
