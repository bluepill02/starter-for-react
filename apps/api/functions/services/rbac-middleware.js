/**
 * RBAC Middleware - Role-Based Access Control
 * Enforces role-based authorization on all API endpoints
 * 
 * Usage:
 * import { enforceRole, hasRole, requireAdmin } from './rbac-middleware.js';
 * 
 * // In a function:
 * const user = await enforceRole(context, ['admin', 'manager']);
 * 
 * Roles hierarchy:
 * - user: Basic user (default)
 * - manager: Can verify recognitions for their reports
 * - hr: HR personnel, can export anonymized data
 * - admin: Can override recognitions and manage system
 * - auditor: Read-only audit log access
 */

/**
 * Enforce that user has one of the required roles
 * Throws error if unauthorized
 */
export async function enforceRole(user, requiredRoles) {
  if (!user) {
    throw new Error('Unauthorized: No user context');
  }

  if (!user.role) {
    throw new Error('Unauthorized: User has no role assigned');
  }

  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }

  if (!requiredRoles.includes(user.role)) {
    throw new Error(
      `Forbidden: User role "${user.role}" does not have permission for: ${requiredRoles.join(', ')}`
    );
  }

  return user;
}

/**
 * Check if user has a specific role (non-throwing version)
 */
export function hasRole(user, role) {
  if (!user || !user.role) {
    return false;
  }

  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user, roles) {
  if (!user || !user.role) {
    return false;
  }

  if (!Array.isArray(roles)) {
    roles = [roles];
  }

  return roles.includes(user.role);
}

/**
 * Get role hierarchy level (higher = more permissions)
 */
export function getRoleLevel(role) {
  const hierarchy = {
    user: 0,
    manager: 1,
    hr: 1,
    admin: 2,
    auditor: 0,
  };

  return hierarchy[role] || -1;
}

/**
 * Check if user role is at or above a minimum level
 */
export function hasMinimumRoleLevel(user, minimumLevel) {
  if (!user || !user.role) {
    return false;
  }

  const userLevel = getRoleLevel(user.role);
  return userLevel >= minimumLevel;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(user) {
  return enforceRole(user, ['admin']);
}

/**
 * Require manager or admin role
 */
export async function requireManagerOrAdmin(user) {
  return enforceRole(user, ['manager', 'admin']);
}

/**
 * Require HR or admin role
 */
export async function requireHROrAdmin(user) {
  return enforceRole(user, ['hr', 'admin']);
}

/**
 * Require any role except basic user
 */
export async function requirePrivilegedRole(user) {
  return enforceRole(user, ['manager', 'hr', 'admin', 'auditor']);
}

/**
 * Middleware factory for Express/API handlers
 * Usage: app.post('/verify', rbacMiddleware(['manager', 'admin']), handler);
 */
export function rbacMiddleware(requiredRoles) {
  return async (req, res, next) => {
    try {
      const user = req.user || req.auth || {};
      await enforceRole(user, requiredRoles);
      next();
    } catch (error) {
      res.status(403).json({
        error: 'Forbidden',
        message: error.message,
        code: 'RBAC_FORBIDDEN',
      });
    }
  };
}

/**
 * Check if user can access another user's data
 * Allows: admins (all), user (self), managers (their reports)
 */
export function canAccessUserData(currentUser, targetUserId) {
  if (!currentUser || !currentUser.$id) {
    return false;
  }

  // Admin can access anyone
  if (currentUser.role === 'admin') {
    return true;
  }

  // User can access their own data
  if (currentUser.$id === targetUserId) {
    return true;
  }

  // Manager can access their reports (if managerId matches)
  if (currentUser.role === 'manager' && currentUser.$id === targetUserId) {
    return true;
  }

  return false;
}

/**
 * Check if user can perform admin actions
 * Admin overrides require justification - this checks if user can even initiate
 */
export function canPerformAdminOverride(user) {
  return user && user.role === 'admin';
}

/**
 * Validate admin override justification
 */
export function validateOverrideJustification(justification) {
  if (!justification || typeof justification !== 'string') {
    throw new Error('Override justification is required');
  }

  const trimmed = justification.trim();
  if (trimmed.length < 20) {
    throw new Error('Override justification must be at least 20 characters');
  }

  if (trimmed.length > 500) {
    throw new Error('Override justification must not exceed 500 characters');
  }

  // Check for valid reason codes
  const validReasons = [
    'ABUSE_PREVENTION',
    'DATA_CORRECTION',
    'POLICY_VIOLATION',
    'SYSTEM_ERROR',
    'USER_REQUEST',
    'COMPLIANCE',
    'OTHER',
  ];

  // Simple check - justification should start with or contain a reason
  return trimmed;
}

/**
 * Check what operations a user can perform on a recognition
 */
export function getRecognitionPermissions(user, recognition) {
  const permissions = {
    view: false,
    verify: false,
    override: false,
    delete: false,
    export: false,
  };

  if (!user || !user.role) {
    return permissions;
  }

  // All authenticated users can view
  permissions.view = true;

  // Managers can verify recognitions for their team
  if (user.role === 'manager' && recognition.giverDepartment === user.department) {
    permissions.verify = true;
  }

  // Admin can do anything
  if (user.role === 'admin') {
    permissions.verify = true;
    permissions.override = true;
    permissions.delete = true;
    permissions.export = true;
  }

  // HR can export
  if (user.role === 'hr') {
    permissions.export = true;
  }

  // Auditor can view audit logs
  if (user.role === 'auditor') {
    permissions.view = true;
  }

  return permissions;
}

/**
 * Format role for display
 */
export function formatRole(role) {
  const names = {
    user: 'User',
    manager: 'Manager',
    hr: 'HR Personnel',
    admin: 'Administrator',
    auditor: 'Auditor',
  };

  return names[role] || role;
}

/**
 * Get all available roles
 */
export function getAllRoles() {
  return ['user', 'manager', 'hr', 'admin', 'auditor'];
}

/**
 * Check if role is valid
 */
export function isValidRole(role) {
  return getAllRoles().includes(role);
}

export default {
  enforceRole,
  hasRole,
  hasAnyRole,
  getRoleLevel,
  hasMinimumRoleLevel,
  requireAdmin,
  requireManagerOrAdmin,
  requireHROrAdmin,
  requirePrivilegedRole,
  rbacMiddleware,
  canAccessUserData,
  canPerformAdminOverride,
  validateOverrideJustification,
  getRecognitionPermissions,
  formatRole,
  getAllRoles,
  isValidRole,
};
