// Role-Based Access Control (RBAC) System
import { z } from 'zod';

// Core role definitions
export const RoleSchema = z.enum([
  'user',           // Basic user - can give/receive recognition
  'team_lead',      // Team leader - can verify team recognition
  'manager',        // Manager - can verify across teams
  'admin',          // Admin - user management, settings
  'super_admin',    // Super admin - system-level operations
  'auditor',        // Auditor - read-only access to all data
]);

export type Role = z.infer<typeof RoleSchema>;

// Specific privileges that can be granted
export const PrivilegeSchema = z.enum([
  // Recognition privileges
  'recognition.create',
  'recognition.verify',
  'recognition.verify_any',
  'recognition.export',
  
  // User management privileges
  'users.view',
  'users.create',
  'users.edit',
  'users.deactivate',
  'users.delete',
  'users.impersonate',
  
  // Role management privileges
  'roles.view',
  'roles.assign',
  'roles.revoke',
  'roles.create_admin',
  'roles.emergency_revoke',
  
  // System administration
  'system.settings',
  'system.integrations',
  'system.audit_logs',
  'system.export_data',
  'system.backup',
  'system.maintenance',
  
  // Security privileges
  'security.view_audit',
  'security.manage_sessions',
  'security.manage_api_keys',
  'security.configure_sso',
  
  // Compliance and reporting
  'compliance.view_reports',
  'compliance.export_reports',
  'compliance.manage_policies',
  
  // Emergency operations
  'emergency.suspend_user',
  'emergency.system_shutdown',
  'emergency.data_lockdown',
]);

export type Privilege = z.infer<typeof PrivilegeSchema>;

// Role hierarchy and privilege mapping
export const ROLE_HIERARCHY: Record<Role, number> = {
  user: 1,
  team_lead: 2,
  manager: 3,
  admin: 4,
  super_admin: 5,
  auditor: 3, // Special role with read access
};

// Default privileges for each role
export const ROLE_PRIVILEGES: Record<Role, Privilege[]> = {
  user: [
    'recognition.create',
  ],
  
  team_lead: [
    'recognition.create',
    'recognition.verify',
    'users.view',
  ],
  
  manager: [
    'recognition.create',
    'recognition.verify',
    'recognition.verify_any',
    'recognition.export',
    'users.view',
    'users.edit',
  ],
  
  admin: [
    'recognition.create',
    'recognition.verify',
    'recognition.verify_any',
    'recognition.export',
    'users.view',
    'users.create',
    'users.edit',
    'users.deactivate',
    'roles.view',
    'roles.assign',
    'roles.revoke',
    'system.settings',
    'system.integrations',
    'system.audit_logs',
    'security.view_audit',
    'security.manage_sessions',
    'compliance.view_reports',
  ],
  
  super_admin: [
    // All privileges
    ...Object.values(PrivilegeSchema.enum),
  ],
  
  auditor: [
    'recognition.export',
    'users.view',
    'roles.view',
    'system.audit_logs',
    'security.view_audit',
    'compliance.view_reports',
    'compliance.export_reports',
  ],
};

// Privilege elevation request schema
export const PrivilegeElevationRequestSchema = z.object({
  userId: z.string(),
  requestedRole: RoleSchema,
  requestedPrivileges: z.array(PrivilegeSchema).optional(),
  reason: z.string().min(20, 'Justification must be at least 20 characters'),
  duration: z.enum(['permanent', '1_hour', '8_hours', '24_hours', '7_days']),
  requestedBy: z.string(),
  approvedBy: z.string().optional(),
  emergencyEscalation: z.boolean().default(false),
});

export type PrivilegeElevationRequest = z.infer<typeof PrivilegeElevationRequestSchema>;

// Audit event schema for privilege changes
export const PrivilegeAuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  action: z.enum([
    'role_assigned',
    'role_revoked',
    'privilege_granted',
    'privilege_revoked',
    'elevation_requested',
    'elevation_approved',
    'elevation_denied',
    'emergency_revoke',
    'session_elevated',
    'session_de_elevated',
  ]),
  subjectUserId: z.string(), // User whose privileges were changed
  actorUserId: z.string(),   // User who made the change
  previousRole: RoleSchema.optional(),
  newRole: RoleSchema.optional(),
  privilegesChanged: z.array(PrivilegeSchema).optional(),
  reason: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  requiresReview: z.boolean().default(false),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
});

export type PrivilegeAuditEvent = z.infer<typeof PrivilegeAuditEventSchema>;

// User with role and privilege information
export const UserWithPrivilegesSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  privileges: z.array(PrivilegeSchema),
  temporaryElevations: z.array(z.object({
    privilege: PrivilegeSchema,
    expiresAt: z.string(),
    grantedBy: z.string(),
    reason: z.string(),
  })).optional(),
  isActive: z.boolean(),
  lastLoginAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserWithPrivileges = z.infer<typeof UserWithPrivilegesSchema>;

// RBAC utility class
export class RBACManager {
  // Check if user has specific privilege
  static hasPrivilege(user: UserWithPrivileges, privilege: Privilege): boolean {
    // Check direct privileges
    if (user.privileges.includes(privilege)) {
      return true;
    }
    
    // Check temporary elevations
    if (user.temporaryElevations) {
      const validElevation = user.temporaryElevations.find(
        elevation => 
          elevation.privilege === privilege && 
          new Date(elevation.expiresAt) > new Date()
      );
      if (validElevation) {
        return true;
      }
    }
    
    return false;
  }

  // Check if user can perform action on target user
  static canManageUser(actor: UserWithPrivileges, target: UserWithPrivileges): boolean {
    const actorHierarchy = ROLE_HIERARCHY[actor.role];
    const targetHierarchy = ROLE_HIERARCHY[target.role];
    
    // Can only manage users with lower hierarchy (except auditors)
    if (actor.role === 'auditor') {
      return false; // Auditors cannot manage users
    }
    
    return actorHierarchy > targetHierarchy;
  }

  // Get all privileges for a role
  static getPrivilegesForRole(role: Role): Privilege[] {
    return ROLE_PRIVILEGES[role] || [];
  }

  // Check if role assignment is valid
  static canAssignRole(actor: UserWithPrivileges, targetRole: Role): boolean {
    const actorHierarchy = ROLE_HIERARCHY[actor.role];
    const targetHierarchy = ROLE_HIERARCHY[targetRole];
    
    // Super admin can assign any role
    if (actor.role === 'super_admin') {
      return true;
    }
    
    // Admin can assign roles below admin level
    if (actor.role === 'admin') {
      return targetHierarchy < ROLE_HIERARCHY.admin;
    }
    
    // Others cannot assign roles
    return false;
  }

  // Validate privilege elevation request
  static validateElevationRequest(
    request: PrivilegeElevationRequest,
    actor: UserWithPrivileges
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if actor can grant the requested role
    if (!this.canAssignRole(actor, request.requestedRole)) {
      errors.push('You do not have permission to assign this role');
    }
    
    // Check if requested privileges are valid for the role
    if (request.requestedPrivileges) {
      const rolePrivileges = this.getPrivilegesForRole(request.requestedRole);
      const invalidPrivileges = request.requestedPrivileges.filter(
        priv => !rolePrivileges.includes(priv)
      );
      
      if (invalidPrivileges.length > 0) {
        errors.push(`Invalid privileges for role: ${invalidPrivileges.join(', ')}`);
      }
    }
    
    // Emergency escalation requires super admin
    if (request.emergencyEscalation && actor.role !== 'super_admin') {
      errors.push('Emergency escalation requires super admin privileges');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Get privilege display information
  static getPrivilegeInfo(privilege: Privilege): { name: string; description: string; category: string } {
    const privilegeInfo: Record<Privilege, { name: string; description: string; category: string }> = {
      'recognition.create': {
        name: 'Create Recognition',
        description: 'Can create new recognition entries',
        category: 'Recognition',
      },
      'recognition.verify': {
        name: 'Verify Recognition',
        description: 'Can verify recognition entries',
        category: 'Recognition',
      },
      'recognition.verify_any': {
        name: 'Verify Any Recognition',
        description: 'Can verify recognition across all teams',
        category: 'Recognition',
      },
      'recognition.export': {
        name: 'Export Recognition Data',
        description: 'Can export recognition reports and data',
        category: 'Recognition',
      },
      'users.view': {
        name: 'View Users',
        description: 'Can view user profiles and information',
        category: 'User Management',
      },
      'users.create': {
        name: 'Create Users',
        description: 'Can create new user accounts',
        category: 'User Management',
      },
      'users.edit': {
        name: 'Edit Users',
        description: 'Can modify user profiles and settings',
        category: 'User Management',
      },
      'users.deactivate': {
        name: 'Deactivate Users',
        description: 'Can deactivate user accounts',
        category: 'User Management',
      },
      'users.delete': {
        name: 'Delete Users',
        description: 'Can permanently delete user accounts',
        category: 'User Management',
      },
      'users.impersonate': {
        name: 'Impersonate Users',
        description: 'Can sign in as other users for support',
        category: 'User Management',
      },
      'roles.view': {
        name: 'View Roles',
        description: 'Can view role assignments and privileges',
        category: 'Role Management',
      },
      'roles.assign': {
        name: 'Assign Roles',
        description: 'Can assign roles to users',
        category: 'Role Management',
      },
      'roles.revoke': {
        name: 'Revoke Roles',
        description: 'Can revoke roles from users',
        category: 'Role Management',
      },
      'roles.create_admin': {
        name: 'Create Admin',
        description: 'Can elevate users to admin status',
        category: 'Role Management',
      },
      'roles.emergency_revoke': {
        name: 'Emergency Revoke',
        description: 'Can immediately revoke any user\'s privileges',
        category: 'Role Management',
      },
      'system.settings': {
        name: 'System Settings',
        description: 'Can modify system-wide settings',
        category: 'System Administration',
      },
      'system.integrations': {
        name: 'System Integrations',
        description: 'Can manage third-party integrations',
        category: 'System Administration',
      },
      'system.audit_logs': {
        name: 'System Audit Logs',
        description: 'Can view and export system audit logs',
        category: 'System Administration',
      },
      'system.export_data': {
        name: 'Export System Data',
        description: 'Can export system data and backups',
        category: 'System Administration',
      },
      'system.backup': {
        name: 'System Backup',
        description: 'Can create and manage system backups',
        category: 'System Administration',
      },
      'system.maintenance': {
        name: 'System Maintenance',
        description: 'Can perform system maintenance operations',
        category: 'System Administration',
      },
      'security.view_audit': {
        name: 'View Security Audit',
        description: 'Can view security audit logs and reports',
        category: 'Security',
      },
      'security.manage_sessions': {
        name: 'Manage Sessions',
        description: 'Can view and terminate user sessions',
        category: 'Security',
      },
      'security.manage_api_keys': {
        name: 'Manage API Keys',
        description: 'Can create and revoke API keys',
        category: 'Security',
      },
      'security.configure_sso': {
        name: 'Configure SSO',
        description: 'Can configure single sign-on settings',
        category: 'Security',
      },
      'compliance.view_reports': {
        name: 'View Compliance Reports',
        description: 'Can view compliance and audit reports',
        category: 'Compliance',
      },
      'compliance.export_reports': {
        name: 'Export Compliance Reports',
        description: 'Can export compliance reports and data',
        category: 'Compliance',
      },
      'compliance.manage_policies': {
        name: 'Manage Compliance Policies',
        description: 'Can create and modify compliance policies',
        category: 'Compliance',
      },
      'emergency.suspend_user': {
        name: 'Emergency User Suspension',
        description: 'Can immediately suspend user accounts',
        category: 'Emergency Operations',
      },
      'emergency.system_shutdown': {
        name: 'Emergency System Shutdown',
        description: 'Can initiate emergency system shutdown',
        category: 'Emergency Operations',
      },
      'emergency.data_lockdown': {
        name: 'Emergency Data Lockdown',
        description: 'Can lock down data access in emergencies',
        category: 'Emergency Operations',
      },
    };

    return privilegeInfo[privilege] || {
      name: privilege,
      description: 'Unknown privilege',
      category: 'Unknown',
    };
  }

  // Get role display information
  static getRoleInfo(role: Role): { name: string; description: string; level: number } {
    const roleInfo: Record<Role, { name: string; description: string; level: number }> = {
      user: {
        name: 'User',
        description: 'Basic user with recognition privileges',
        level: ROLE_HIERARCHY.user,
      },
      team_lead: {
        name: 'Team Lead',
        description: 'Team leader with verification privileges',
        level: ROLE_HIERARCHY.team_lead,
      },
      manager: {
        name: 'Manager',
        description: 'Manager with cross-team privileges',
        level: ROLE_HIERARCHY.manager,
      },
      admin: {
        name: 'Administrator',
        description: 'Administrator with system management privileges',
        level: ROLE_HIERARCHY.admin,
      },
      super_admin: {
        name: 'Super Administrator',
        description: 'Super administrator with full system access',
        level: ROLE_HIERARCHY.super_admin,
      },
      auditor: {
        name: 'Auditor',
        description: 'Auditor with read-only access to all data',
        level: ROLE_HIERARCHY.auditor,
      },
    };

    return roleInfo[role];
  }
}