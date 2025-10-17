
import { Client, Users, Databases, ID } from 'node-appwrite';
import { AuditEntrySchema } from '../../../../packages/schema/src/types';

// SCIM operation types
interface ScimUser {
  id?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{
    value: string;
    primary: boolean;
  }>;
  active: boolean;
  roles?: string[];
  department?: string;
  manager?: {
    value: string;
    displayName: string;
  };
}

interface ScimOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: any;
}

interface ScimRequest {
  schemas: string[];
  Operations: ScimOperation[];
  Resources?: ScimUser[];
  startIndex?: number;
  count?: number;
}

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
// Database configuration loaded from environment
const AUDIT_DATABASE_ID = process.env.AUDIT_DATABASE_ID || 'audit';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

// Initialize Appwrite client for server-side operations
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const users = new Users(client);
const databases = new Databases(client);

// Hash user ID for privacy in audit logs
function hashUserId(userId: string): string {
  // In production, use a proper hashing library like crypto
  return Buffer.from(userId).toString('base64').replace(/[+=\/]/g, '').substring(0, 16);
}

// Create audit entry
async function createAuditEntry(
  eventCode: string,
  actorId: string,
  targetId?: string,
  metadata?: Record<string, any>,
  req?: any
): Promise<void> {
  try {
    const auditEntry = {
      $id: ID.unique(),
      eventCode,
      actorId: hashUserId(actorId),
      targetId: targetId ? hashUserId(targetId) : undefined,
      metadata,
      ipAddress: req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'],
      userAgent: req?.headers?.['user-agent'],
      createdAt: new Date().toISOString(),
    };

    // Validate with schema
    const validatedEntry = AuditEntrySchema.parse(auditEntry);

    await databases.createDocument(
      AUDIT_DATABASE_ID,
      AUDIT_COLLECTION_ID,
      validatedEntry.$id,
      validatedEntry
    );
  } catch (error) {
    console.error('Failed to create audit entry:', error);
    // Don't fail the main operation if audit logging fails
  }
}

// Map SCIM user to Appwrite user
function mapScimToUser(scimUser: ScimUser): any {
  const email = scimUser.emails.find(e => e.primary)?.value || scimUser.emails[0]?.value;
  const fullName = `${scimUser.name.givenName} ${scimUser.name.familyName}`.trim();
  
  // Determine role from SCIM roles
  let role = 'USER';
  if (scimUser.roles?.includes('admin') || scimUser.roles?.includes('Administrator')) {
    role = 'ADMIN';
  } else if (scimUser.roles?.includes('manager') || scimUser.roles?.includes('Manager')) {
    role = 'MANAGER';
  }

  return {
    name: fullName,
    email,
    prefs: {
      role,
      department: scimUser.department,
      managerId: scimUser.manager?.value,
    },
    labels: [role.toLowerCase()], // Store role in labels as well
  };
}

// Create new user
async function createUser(scimUser: ScimUser, actorId: string, req: any): Promise<string> {
  try {
    const userData = mapScimToUser(scimUser);
    
    // Create user in Appwrite
    const newUser = await users.create(
      ID.unique(),
      userData.email,
      undefined, // No password for SCIM users
      userData.name,
      undefined // No phone
    );

    // Update user preferences and labels
    await users.updatePrefs(newUser.$id, userData.prefs);
    await users.updateLabels(newUser.$id, userData.labels);

    // Create audit entry
    await createAuditEntry(
      'USER_SYNCED',
      actorId,
      newUser.$id,
      {
        action: 'create',
        scimId: scimUser.id,
        email: userData.email,
        role: userData.prefs.role,
      },
      req
    );

    return newUser.$id;
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}

// Update existing user
async function updateUser(userId: string, scimUser: ScimUser, actorId: string, req: any): Promise<void> {
  try {
    const userData = mapScimToUser(scimUser);
    
    // Update user name and email if needed
    const existingUser = await users.get(userId);
    
    if (existingUser.name !== userData.name) {
      await users.updateName(userId, userData.name);
    }
    
    if (existingUser.email !== userData.email) {
      await users.updateEmail(userId, userData.email);
    }

    // Update preferences and labels
    await users.updatePrefs(userId, userData.prefs);
    await users.updateLabels(userId, userData.labels);

    // Create audit entry
    await createAuditEntry(
      'USER_SYNCED',
      actorId,
      userId,
      {
        action: 'update',
        scimId: scimUser.id,
        email: userData.email,
        role: userData.prefs.role,
        changes: {
          name: existingUser.name !== userData.name ? userData.name : undefined,
          email: existingUser.email !== userData.email ? userData.email : undefined,
        },
      },
      req
    );
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}

// Delete user
async function deleteUser(userId: string, actorId: string, req: any): Promise<void> {
  try {
    const existingUser = await users.get(userId);
    
    // Instead of deleting, we disable the user by removing their sessions and marking as inactive
    await users.deleteSessions(userId);
    
    // Update user status in preferences
    const currentPrefs = existingUser.prefs || {};
    await users.updatePrefs(userId, {
      ...currentPrefs,
      active: false,
      deletedAt: new Date().toISOString(),
    });

    // Create audit entry
    await createAuditEntry(
      'USER_SYNCED',
      actorId,
      userId,
      {
        action: 'delete',
        email: existingUser.email,
      },
      req
    );
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

// Find user by email
/* eslint-disable @typescript-eslint/no-unused-vars */
// Helper function to find user by email (for future use)
async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const usersList = await users.list([`email.equal("${email}")`]);
    return usersList.users.length > 0 ? usersList.users[0].$id : null;
  } catch (error) {
    console.error('Failed to find user by email:', error);
    return null;
  }
}

// Main SCIM sync handler
export default async function handler(req: any, res: any) {
  // Verify SCIM authentication
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.SCIM_AUTH_TOKEN;
  
  if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid authentication',
      status: 401,
    });
  }

  const method = req.method;
  const body: ScimRequest = req.body || {};
  
  // Extract actor ID from token or use system ID
  const actorId = 'system-scim'; // In production, extract from JWT or API key
  
  try {
    switch (method) {
      case 'POST':
        // Bulk operations or single user creation
        if (body.Operations && body.Operations.length > 0) {
          // Handle bulk operations
          const results = [];
          
          for (const operation of body.Operations) {
            switch (operation.op) {
              case 'add':
                if (operation.value && operation.value.Resources) {
                  for (const scimUser of operation.value.Resources) {
                    const userId = await createUser(scimUser, actorId, req);
                    results.push({ id: userId, status: 'created' });
                  }
                }
                break;
                
              case 'replace':
                // Handle user updates
                if (operation.value && operation.path) {
                  const userId = operation.path.replace('/Users/', '');
                  await updateUser(userId, operation.value as ScimUser, actorId, req);
                  results.push({ id: userId, status: 'updated' });
                }
                break;
                
              case 'remove':
                // Handle user deletion
                if (operation.path) {
                  const userId = operation.path.replace('/Users/', '');
                  await deleteUser(userId, actorId, req);
                  results.push({ id: userId, status: 'deleted' });
                }
                break;
            }
          }
          
          return res.status(200).json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:BulkResponse'],
            Operations: results,
          });
        } else if (body.Resources && body.Resources.length > 0) {
          // Single user creation from Resources array
          const scimUser = body.Resources[0];
          const userId = await createUser(scimUser, actorId, req);
          
          return res.status(201).json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
            id: userId,
            userName: scimUser.userName,
            active: true,
          });
        }
        break;
        
      case 'PUT':
      case 'PATCH':
        // Update existing user
        const userId = req.query.id || req.params.id;
        if (!userId) {
          return res.status(400).json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: 'User ID required',
            status: 400,
          });
        }
        
        // For PATCH, handle operations array
        if (method === 'PATCH' && body.Operations) {
          for (const operation of body.Operations) {
            if (operation.op === 'replace' && operation.value) {
              await updateUser(userId, operation.value as ScimUser, actorId, req);
            }
          }
        } else {
          // For PUT, update with full user object
          await updateUser(userId, body as unknown as ScimUser, actorId, req);
        }
        
        return res.status(200).json({
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: userId,
          active: true,
        });
        
      case 'DELETE':
        // Delete user
        const deleteUserId = req.query.id || req.params.id;
        if (!deleteUserId) {
          return res.status(400).json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: 'User ID required',
            status: 400,
          });
        }
        
        await deleteUser(deleteUserId, actorId, req);
        
        return res.status(204).send();
        
      case 'GET':
        // Query users (for SCIM discovery)
        return res.status(200).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: 0,
          Resources: [],
          startIndex: 1,
          itemsPerPage: 0,
        });
        
      default:
        return res.status(405).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          detail: 'Method not allowed',
          status: 405,
        });
    }
  } catch (error) {
    console.error('SCIM sync error:', error);
    
    return res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Internal server error',
      status: 500,
    });
  }
}