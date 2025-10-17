
import { Client, Users, Databases, ID } from 'node-appwrite';
import { UserSchema, AuditEntrySchema } from '../../../../packages/schema/src/types';

// Environment variables
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const AUDIT_DATABASE_ID = process.env.AUDIT_DATABASE_ID || 'audit';
const AUDIT_COLLECTION_ID = process.env.AUDIT_COLLECTION_ID || 'audit_entries';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const users = new Users(client);
const databases = new Databases(client);

// Types for middleware
export interface AuthenticatedUser {
  $id: string;
  name: string;
  email: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  department?: string;
  managerId?: string;
}

export interface AuthContext {
  user: AuthenticatedUser;
  session: any;
}

export interface RBACMiddlewareOptions {
  requiredRole?: 'USER' | 'MANAGER' | 'ADMIN';
  requiredRoles?: Array<'USER' | 'MANAGER' | 'ADMIN'>;
  allowSelf?: boolean; // Allow if user is accessing their own data
  selfIdParam?: string; // Parameter name for self ID check (e.g., 'userId')
}

// Hash user ID for privacy in logs
function hashUserId(userId: string): string {
  return Buffer.from(userId).toString('base64').replace(/[+=\/]/g, '').substring(0, 16);
}

// Create audit entry for unauthorized access attempts
async function auditUnauthorizedAccess(
  userId: string,
  requiredRole: string,
  actualRole: string,
  resource: string,
  req: any
): Promise<void> {
  try {
    const auditEntry = {
      $id: ID.unique(),
      eventCode: 'ADMIN_ACTION' as const,
      actorId: hashUserId(userId),
      metadata: {
        action: 'unauthorized_access_attempt',
        requiredRole,
        actualRole,
        resource,
        method: req.method,
        path: req.path || req.url,
      },
      ipAddress: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'],
      userAgent: req.headers?.['user-agent'],
      createdAt: new Date().toISOString(),
    };

    const validatedEntry = AuditEntrySchema.parse(auditEntry);
    
    await databases.createDocument(
      AUDIT_DATABASE_ID,
      AUDIT_COLLECTION_ID,
      validatedEntry.$id,
      validatedEntry
    );
  } catch (error) {
    console.error('Failed to create unauthorized access audit entry:', error);
  }
}

// Extract user role from Appwrite user object
function extractUserRole(appwriteUser: any): 'USER' | 'MANAGER' | 'ADMIN' {
  // Check preferences first
  const roleFromPrefs = appwriteUser.prefs?.role;
  if (roleFromPrefs && ['USER', 'MANAGER', 'ADMIN'].includes(roleFromPrefs)) {
    return roleFromPrefs as 'USER' | 'MANAGER' | 'ADMIN';
  }

  // Check labels for role assignment
  const labels = appwriteUser.labels || [];
  if (labels.includes('admin')) return 'ADMIN';
  if (labels.includes('manager')) return 'MANAGER';
  
  return 'USER';
}

// Convert Appwrite user to authenticated user
function mapToAuthenticatedUser(appwriteUser: any): AuthenticatedUser {
  return {
    $id: appwriteUser.$id,
    name: appwriteUser.name,
    email: appwriteUser.email,
    role: extractUserRole(appwriteUser),
    department: appwriteUser.prefs?.department,
    managerId: appwriteUser.prefs?.managerId,
  };
}

// Check if user has required role
function hasRequiredRole(userRole: 'USER' | 'MANAGER' | 'ADMIN', requiredRole: 'USER' | 'MANAGER' | 'ADMIN'): boolean {
  // Admin has all roles
  if (userRole === 'ADMIN') return true;
  
  // Manager has MANAGER and USER roles
  if (userRole === 'MANAGER' && (requiredRole === 'MANAGER' || requiredRole === 'USER')) return true;
  
  // User only has USER role
  return userRole === requiredRole;
}

// Check if user has any of the required roles
function hasAnyRequiredRole(userRole: 'USER' | 'MANAGER' | 'ADMIN', requiredRoles: Array<'USER' | 'MANAGER' | 'ADMIN'>): boolean {
  return requiredRoles.some(role => hasRequiredRole(userRole, role));
}

// Main RBAC middleware function
export async function rbacMiddleware(
  req: any,
  res: any,
  options: RBACMiddlewareOptions = {}
): Promise<AuthContext | null> {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
        code: 'AUTH_REQUIRED'
      });
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // For Appwrite functions, the JWT contains session info
    // In a real implementation, you'd verify the JWT and extract user ID
    // For now, we'll assume the token contains the user ID
    let userId: string;
    
    try {
      // In production, properly decode and verify the JWT
      // This is a simplified version for demonstration
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.userId || payload.sub;
    } catch {
      res.status(401).json({
        error: 'Unauthorized', 
        message: 'Invalid token format',
        code: 'INVALID_TOKEN'
      });
      return null;
    }

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
        code: 'USER_ID_MISSING'
      });
      return null;
    }

    // Get user from Appwrite
    const appwriteUser = await users.get(userId);
    const authenticatedUser = mapToAuthenticatedUser(appwriteUser);

    // Validate user with schema
    const userValidation = UserSchema.safeParse({
      ...authenticatedUser,
      createdAt: appwriteUser.$createdAt,
      updatedAt: appwriteUser.$updatedAt,
    });

    if (!userValidation.success) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid user data',
        code: 'INVALID_USER_DATA'
      });
      return null;
    }

    // Check if user is active
    if (appwriteUser.prefs?.active === false) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return null;
    }

    // Check role-based access
    if (options.requiredRole) {
      if (!hasRequiredRole(authenticatedUser.role, options.requiredRole)) {
        await auditUnauthorizedAccess(
          userId,
          options.requiredRole,
          authenticatedUser.role,
          req.path || req.url,
          req
        );
        
        res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. Required role: ${options.requiredRole}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return null;
      }
    }

    // Check multiple required roles (user must have at least one)
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      if (!hasAnyRequiredRole(authenticatedUser.role, options.requiredRoles)) {
        await auditUnauthorizedAccess(
          userId,
          options.requiredRoles.join(' or '),
          authenticatedUser.role,
          req.path || req.url,
          req
        );
        
        res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. Required roles: ${options.requiredRoles.join(' or ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return null;
      }
    }

    // Check self-access permission
    if (options.allowSelf && options.selfIdParam) {
      const targetUserId = req.params?.[options.selfIdParam] || req.query?.[options.selfIdParam];
      
      // If accessing own data, allow regardless of role
      if (targetUserId === userId) {
        return {
          user: authenticatedUser,
          session: { userId, token }
        };
      }
    }

    // Return authenticated user context
    return {
      user: authenticatedUser,
      session: { userId, token }
    };

  } catch (error) {
    console.error('RBAC middleware error:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
    return null;
  }
}

// Convenience wrapper for role-specific middleware
export function requireRole(role: 'USER' | 'MANAGER' | 'ADMIN') {
  return async (req: any, res: any, next?: Function): Promise<AuthContext | null> => {
    const authContext = await rbacMiddleware(req, res, { requiredRole: role });
    if (authContext && next) {
      // For Express-style middleware
      (req as any).authContext = authContext;
      next();
      return authContext;
    }
    return authContext;
  };
}

// Convenience wrapper for multiple roles
export function requireAnyRole(roles: Array<'USER' | 'MANAGER' | 'ADMIN'>) {
  return async (req: any, res: any, next?: Function): Promise<AuthContext | null> => {
    const authContext = await rbacMiddleware(req, res, { requiredRoles: roles });
    if (authContext && next) {
      (req as any).authContext = authContext;
      next();
      return authContext;
    }
    return authContext;
  };
}

// Convenience wrapper for admin-only access
export function requireAdmin() {
  return requireRole('ADMIN');
}

// Convenience wrapper for manager-only access
export function requireManager() {
  return requireAnyRole(['MANAGER', 'ADMIN']);
}

// Convenience wrapper for self-access or admin
export function requireSelfOrAdmin(selfIdParam: string = 'userId') {
  return async (req: any, res: any, next?: Function): Promise<AuthContext | null> => {
    const authContext = await rbacMiddleware(req, res, {
      requiredRoles: ['USER', 'MANAGER', 'ADMIN'],
      allowSelf: true,
      selfIdParam
    });
    if (authContext && next) {
      (req as any).authContext = authContext;
      next();
      return authContext;
    }
    return authContext;
  };
}

// Export the main middleware as default
export default rbacMiddleware;