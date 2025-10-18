/**
 * Reproducible Test Data & Fixtures
 * Used across unit, integration, and E2E tests
 */

const testUsers = {
  alice: {
    id: 'user-alice-123',
    email: 'alice@company.com',
    name: 'Alice Manager',
    role: 'manager',
    department: 'Engineering',
    joinedAt: '2023-01-15T00:00:00Z',
  },
  bob: {
    id: 'user-bob-456',
    email: 'bob@company.com',
    name: 'Bob Developer',
    role: 'employee',
    department: 'Engineering',
    joinedAt: '2023-02-20T00:00:00Z',
  },
  carol: {
    id: 'user-carol-789',
    email: 'carol@company.com',
    name: 'Carol Designer',
    role: 'employee',
    department: 'Design',
    joinedAt: '2023-03-10T00:00:00Z',
  },
  dave: {
    id: 'user-dave-012',
    email: 'dave@company.com',
    name: 'Dave Admin',
    role: 'admin',
    department: 'IT',
    joinedAt: '2023-01-01T00:00:00Z',
  },
};

const testRecognitions = {
  basic: {
    id: 'rec-basic-001',
    giverUserId: testUsers.alice.id,
    recipientUserId: testUsers.bob.id,
    reason: 'Great work on the authentication service implementation',
    tags: ['teamwork', 'quality'],
    weight: 1.0,
    verified: false,
    private: false,
    createdAt: '2025-01-10T10:00:00Z',
  },
  highEvidence: {
    id: 'rec-evidence-002',
    giverUserId: testUsers.alice.id,
    recipientUserId: testUsers.carol.id,
    reason: 'Excellent design mockups for the new dashboard',
    tags: ['design', 'innovation'],
    weight: 2.0,
    verified: false,
    private: false,
    evidenceFiles: ['design-mockups.pdf', 'feedback.txt'],
    createdAt: '2025-01-11T14:30:00Z',
  },
  reciprocal: {
    id: 'rec-reciprocal-003',
    giverUserId: testUsers.bob.id,
    recipientUserId: testUsers.alice.id,
    reason: 'Thanks for the code review',
    tags: ['collaboration'],
    weight: 1.0,
    verified: false,
    private: false,
    createdAt: '2025-01-12T09:15:00Z',
  },
  verified: {
    id: 'rec-verified-004',
    giverUserId: testUsers.carol.id,
    recipientUserId: testUsers.bob.id,
    reason: 'Outstanding feature implementation',
    tags: ['quality', 'impact'],
    weight: 1.5,
    verified: true,
    verifiedBy: testUsers.dave.id,
    verificationNote: 'Approved - excellent work',
    private: false,
    createdAt: '2025-01-13T08:00:00Z',
  },
};

const testEvidence = {
  pdf: {
    id: 'evidence-pdf-001',
    recognitionId: testRecognitions.highEvidence.id,
    filename: 'design-mockups.pdf',
    size: 2048576,
    type: 'application/pdf',
    storageId: 's3://evidence-bucket/design-mockups.pdf',
    uploadedAt: '2025-01-11T14:30:00Z',
  },
  document: {
    id: 'evidence-doc-002',
    recognitionId: testRecognitions.highEvidence.id,
    filename: 'feedback.txt',
    size: 512,
    type: 'text/plain',
    storageId: 's3://evidence-bucket/feedback.txt',
    uploadedAt: '2025-01-11T14:31:00Z',
  },
};

const testAuditEvents = {
  recognition_created: {
    id: 'audit-001',
    eventType: 'recognition_created',
    userId: testUsers.alice.id,
    recognitionId: testRecognitions.basic.id,
    timestamp: testRecognitions.basic.createdAt,
    metadata: { reason: testRecognitions.basic.reason },
  },
  recognition_verified: {
    id: 'audit-002',
    eventType: 'recognition_verified',
    userId: testUsers.dave.id,
    recognitionId: testRecognitions.basic.id,
    timestamp: '2025-01-13T08:00:00Z',
    metadata: { verificationNote: 'Approved' },
  },
  abuse_detected: {
    id: 'audit-003',
    eventType: 'abuse_detected',
    recognitionId: testRecognitions.reciprocal.id,
    timestamp: '2025-01-14T10:00:00Z',
    metadata: { reason: 'Excessive reciprocity detected' },
  },
};

const testAbuseFlags = {
  reciprocity: {
    id: 'abuse-flag-001',
    recognitionId: testRecognitions.reciprocal.id,
    flagType: 'RECIPROCITY',
    severity: 'MEDIUM',
    description: 'Excessive mutual recognition pattern between users',
    metadata: {
      giverId: testUsers.bob.id,
      recipientId: testUsers.alice.id,
      count: 6,
      window: '7 days',
    },
  },
  frequency: {
    id: 'abuse-flag-002',
    flagType: 'FREQUENCY',
    severity: 'LOW',
    description: 'Recognition frequency exceeds normal patterns',
    metadata: {
      userId: testUsers.alice.id,
      daily: 10,
      limit: 10,
      period: 'daily',
    },
  },
};

/**
 * Seed test database with fixtures
 * @param {Object} db - Database interface
 */
async function seedTestDatabase(db) {
  // Seed users
  for (const user of Object.values(testUsers)) {
    await db.create('users', user);
  }

  // Seed recognitions
  for (const recognition of Object.values(testRecognitions)) {
    await db.create('recognitions', recognition);
  }

  // Seed evidence
  for (const evidence of Object.values(testEvidence)) {
    await db.create('evidence', evidence);
  }

  // Seed audit events
  for (const event of Object.values(testAuditEvents)) {
    await db.create('audit_entries', event);
  }

  // Seed abuse flags
  for (const flag of Object.values(testAbuseFlags)) {
    await db.create('abuse_flags', flag);
  }
}

/**
 * Create a test user with optional overrides
 * @param {Partial<Object>} overrides - Partial user object
 * @returns {Object} Test user
 */
function createTestUser(overrides = {}) {
  return {
    id: `user-${Date.now()}`,
    email: `user-${Date.now()}@test.com`,
    name: 'Test User',
    role: 'employee',
    department: 'Engineering',
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test recognition with optional overrides
 * @param {Partial<Object>} overrides - Partial recognition object
 * @returns {Object} Test recognition
 */
function createTestRecognition(overrides = {}) {
  return {
    id: `rec-${Date.now()}`,
    giverUserId: testUsers.alice.id,
    recipientUserId: testUsers.bob.id,
    reason: 'Great work on the project',
    tags: ['teamwork'],
    weight: 1.0,
    verified: false,
    private: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a batch of test recognitions
 * @param {number} count - Number of recognitions to create
 * @param {Object} baseOverrides - Base overrides for all recognitions
 * @returns {Array} Array of test recognitions
 */
function createTestRecognitionBatch(count, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createTestRecognition({
      id: `rec-batch-${i}`,
      reason: `Recognition ${i}: Great work on project ${i}`,
      ...baseOverrides,
    })
  );
}

/**
 * Get a random test user
 * @returns {Object} Random test user
 */
function getRandomTestUser() {
  const users = Object.values(testUsers);
  return users[Math.floor(Math.random() * users.length)];
}

/**
 * Reset all mutable test data
 * Used for test cleanup
 */
function resetFixtures() {
  // Fixtures are immutable - create new instances if needed
  // This is a no-op but kept for consistency
}

module.exports = {
  testUsers,
  testRecognitions,
  testEvidence,
  testAuditEvents,
  testAbuseFlags,
  seedTestDatabase,
  createTestUser,
  createTestRecognition,
  createTestRecognitionBatch,
  getRandomTestUser,
  resetFixtures,
};
