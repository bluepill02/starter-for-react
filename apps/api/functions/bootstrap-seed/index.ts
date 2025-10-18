import { Client, Databases, Users, Teams, Storage, ID } from 'node-appwrite';

export default async ({ req, res, log, error }: any) => {
  try {
    log('Starting bootstrap seed process...');

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
      .setProject(process.env.APPWRITE_PROJECT_ID || '')
      .setKey(process.env.APPWRITE_KEY || '');

    const databases = new Databases(client);
    const users = new Users(client);
    const teams = new Teams(client);
    const storage = new Storage(client);

    const databaseId = process.env.DATABASE_ID || 'recognition-db';
    const recognitionCollectionId = process.env.RECOGNITION_COLLECTION_ID || 'recognitions';
    const userCollectionId = process.env.USER_COLLECTION_ID || 'users';
    const teamCollectionId = process.env.TEAM_COLLECTION_ID || 'teams';
    const storageId = process.env.STORAGE_BUCKET_ID || 'evidence';

    // Seed data structure
    const seedData = {
      users: [
        {
          id: 'alice-manager',
          email: 'alice.manager@company.com',
          name: 'Alice Johnson',
          role: 'MANAGER',
          department: 'Engineering',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face',
        },
        {
          id: 'bob-employee',
          email: 'bob.employee@company.com',
          name: 'Bob Smith',
          role: 'USER',
          department: 'Engineering',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        },
        {
          id: 'carol-admin',
          email: 'carol.admin@company.com',
          name: 'Carol Davis',
          role: 'ADMIN',
          department: 'HR',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        },
        {
          id: 'david-employee',
          email: 'david.employee@company.com',
          name: 'David Wilson',
          role: 'USER',
          department: 'Design',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
        },
        {
          id: 'eva-manager',
          email: 'eva.manager@company.com',
          name: 'Eva Rodriguez',
          role: 'MANAGER',
          department: 'Product',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
        },
        {
          id: 'frank-employee',
          email: 'frank.employee@company.com',
          name: 'Frank Chen',
          role: 'USER',
          department: 'Engineering',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        }
      ],
      teams: [
        {
          id: 'engineering-team',
          name: 'Engineering Team',
          description: 'Software development and technical implementation',
          members: ['alice-manager', 'bob-employee', 'frank-employee']
        },
        {
          id: 'product-team',
          name: 'Product Team',
          description: 'Product strategy and roadmap',
          members: ['eva-manager', 'david-employee']
        },
        {
          id: 'leadership-team',
          name: 'Leadership Team',
          description: 'Company leadership and strategic decisions',
          members: ['alice-manager', 'eva-manager', 'carol-admin']
        }
      ],
      recognitions: [
        {
          id: 'rec-001',
          giverId: 'alice-manager',
          recipientId: 'bob-employee',
          reason: 'Outstanding work on the API optimization project. Bob reduced response times by 40% and improved system reliability significantly. His attention to detail and proactive approach to identifying performance bottlenecks was exceptional.',
          tags: ['technical-excellence', 'performance', 'proactive'],
          weight: 2.5,
          evidenceCount: 2,
          visibility: 'PUBLIC',
          status: 'VERIFIED',
          verifierId: 'alice-manager',
          verificationNote: 'Confirmed the performance improvements through monitoring dashboards.',
          verifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-002',
          giverId: 'bob-employee',
          recipientId: 'frank-employee',
          reason: 'Great collaboration on the authentication module. Frank helped debug complex JWT issues and shared his knowledge generously with the team.',
          tags: ['collaboration', 'knowledge-sharing', 'debugging'],
          weight: 1.5,
          evidenceCount: 1,
          visibility: 'PUBLIC',
          status: 'PENDING',
          verifierId: null,
          verificationNote: null,
          verifiedAt: null,
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-003',
          giverId: 'eva-manager',
          recipientId: 'david-employee',
          reason: 'Excellent user experience design for the mobile app. David conducted thorough user research and created intuitive interfaces that increased user engagement by 25%.',
          tags: ['design', 'user-research', 'mobile'],
          weight: 2.0,
          evidenceCount: 3,
          visibility: 'PUBLIC',
          status: 'VERIFIED',
          verifierId: 'eva-manager',
          verificationNote: 'Validated through user analytics and feedback surveys.',
          verifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-004',
          giverId: 'david-employee',
          recipientId: 'eva-manager',
          reason: 'Exceptional leadership during the product launch. Eva coordinated multiple teams effectively and kept everyone motivated through challenging deadlines.',
          tags: ['leadership', 'coordination', 'motivation'],
          weight: 1.8,
          evidenceCount: 0,
          visibility: 'PUBLIC',
          status: 'PENDING',
          verifierId: null,
          verificationNote: null,
          verifiedAt: null,
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-005',
          giverId: 'frank-employee',
          recipientId: 'alice-manager',
          reason: 'Great mentorship and technical guidance. Alice helped me understand complex architectural patterns and always made time for questions.',
          tags: ['mentorship', 'architecture', 'guidance'],
          weight: 1.5,
          evidenceCount: 0,
          visibility: 'PRIVATE',
          status: 'PENDING',
          verifierId: null,
          verificationNote: null,
          verifiedAt: null,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        }
      ]
    };

    let createdUsers = 0;
    let createdTeams = 0;
    let createdRecognitions = 0;

    // Create users
    log('Creating seed users...');
    for (const userData of seedData.users) {
      try {
        // Create user account
        await users.create(
          userData.id,
          userData.email,
          '+1234567890', // Default phone
          'Password123!', // Default password for development
          userData.name
        );

        // Create user profile document
        await databases.createDocument(
          databaseId,
          userCollectionId,
          userData.id,
          {
            userId: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            department: userData.department,
            avatar: userData.avatar,
            isActive: true,
            lastLoginAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );

        createdUsers++;
        log(`Created user: ${userData.name} (${userData.email})`);
      } catch (err: any) {
        if (err.code !== 409) { // Ignore if user already exists
          error(`Failed to create user ${userData.name}: ${err.message}`);
        } else {
          log(`User ${userData.name} already exists, skipping...`);
        }
      }
    }

    // Create teams
    log('Creating seed teams...');
    for (const teamData of seedData.teams) {
      try {
        // Create team
        const team = await teams.create(
          teamData.id,
          teamData.name,
          ['owner', 'member'] // Default roles
        );

        // Create team profile document
        await databases.createDocument(
          databaseId,
          teamCollectionId,
          teamData.id,
          {
            teamId: teamData.id,
            name: teamData.name,
            description: teamData.description,
            memberCount: teamData.members.length,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );

        // Add members to team
        for (const memberId of teamData.members) {
          try {
            await teams.createMembership(
              teamData.id,
              ['member'],
              `${memberId}@company.com`, // Email invitation
              memberId, // User ID
              `${seedData.users.find(u => u.id === memberId)?.name} - Team Member`,
              'http://localhost:3000/teams/accept' // Redirect URL
            );
          } catch (memberErr: any) {
            if (memberErr.code !== 409) {
              error(`Failed to add member ${memberId} to team ${teamData.name}: ${memberErr.message}`);
            }
          }
        }

        createdTeams++;
        log(`Created team: ${teamData.name} with ${teamData.members.length} members`);
      } catch (err: any) {
        if (err.code !== 409) {
          error(`Failed to create team ${teamData.name}: ${err.message}`);
        } else {
          log(`Team ${teamData.name} already exists, skipping...`);
        }
      }
    }

    // Create recognitions
    log('Creating seed recognitions...');
    for (const recData of seedData.recognitions) {
      try {
        await databases.createDocument(
          databaseId,
          recognitionCollectionId,
          recData.id,
          {
            giverId: recData.giverId,
            recipientId: recData.recipientId,
            reason: recData.reason,
            tags: recData.tags,
            weight: recData.weight,
            evidenceCount: recData.evidenceCount,
            visibility: recData.visibility,
            status: recData.status,
            verifierId: recData.verifierId,
            verificationNote: recData.verificationNote,
            verifiedAt: recData.verifiedAt,
            createdAt: recData.createdAt,
            updatedAt: recData.createdAt,
          }
        );

        createdRecognitions++;
        log(`Created recognition: ${recData.giverId} -> ${recData.recipientId}`);
      } catch (err: any) {
        if (err.code !== 409) {
          error(`Failed to create recognition ${recData.id}: ${err.message}`);
        } else {
          log(`Recognition ${recData.id} already exists, skipping...`);
        }
      }
    }

    // Create sample OAuth accounts for testing
    log('Setting up OAuth test accounts...');
    const oauthAccounts = [
      {
        userId: 'alice-manager',
        provider: 'google',
        providerUid: 'google-alice-test-uid',
        providerEmail: 'alice.manager@company.com'
      },
      {
        userId: 'bob-employee',
        provider: 'microsoft',
        providerUid: 'microsoft-bob-test-uid',
        providerEmail: 'bob.employee@company.com'
      }
    ];

    // Note: OAuth identities would typically be created through the OAuth flow
    // For development, we're just noting them here for manual testing
    for (const account of oauthAccounts) {
      log(`OAuth test account available: ${account.provider} - ${account.providerEmail}`);
    }

    const summary = {
      success: true,
      message: 'Bootstrap seed completed successfully',
      results: {
        users: {
          created: createdUsers,
          total: seedData.users.length
        },
        teams: {
          created: createdTeams,
          total: seedData.teams.length
        },
        recognitions: {
          created: createdRecognitions,
          total: seedData.recognitions.length
        }
      },
      testAccounts: {
        admin: 'carol.admin@company.com (Password123!)',
        manager: 'alice.manager@company.com (Password123!)',
        employee: 'bob.employee@company.com (Password123!)',
        designer: 'david.employee@company.com (Password123!)'
      },
      nextSteps: [
        'Access Appwrite Console at http://localhost:8080/console',
        'Test authentication with the created accounts',
        'Run the web application and explore features',
        'Use admin account to access admin features'
      ]
    };

    log('Bootstrap seed completed successfully!');
    log(`Created: ${createdUsers} users, ${createdTeams} teams, ${createdRecognitions} recognitions`);

    return res.json(summary);

  } catch (err: any) {
    error('Bootstrap seed failed:', err);
    return res.json({
      success: false,
      error: err.message,
      message: 'Bootstrap seed failed. Check logs for details.'
    }, 500);
  }
};