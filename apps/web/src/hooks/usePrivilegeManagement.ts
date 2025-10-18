// Secure Privilege Management Service
import { 
  Role, 
  Privilege, 
  UserWithPrivileges, 
  PrivilegeElevationRequest,
  PrivilegeAuditEvent,
  RBACManager,
  PrivilegeElevationRequestSchema,
} from '../lib/rbac';
import { useToastHelpers } from './useToast';
import { useErrorHandler } from './useErrorHandler';

// Privilege management service
export class PrivilegeManagementService {
  private static instance: PrivilegeManagementService;
  private baseUrl = '/api/admin/privileges';

  static getInstance(): PrivilegeManagementService {
    if (!this.instance) {
      this.instance = new PrivilegeManagementService();
    }
    return this.instance;
  }

  // Get user's current privileges with server validation
  async getCurrentUserPrivileges(): Promise<UserWithPrivileges> {
    const response = await fetch(`${this.baseUrl}/current`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user privileges: ${response.statusText}`);
    }

    return response.json();
  }

  // Get all users with their privileges (admin only)
  async getAllUsersWithPrivileges(): Promise<UserWithPrivileges[]> {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    return response.json();
  }

  // Request privilege elevation
  async requestPrivilegeElevation(request: PrivilegeElevationRequest): Promise<{ requestId: string }> {
    // Validate request on client side first
    const validatedRequest = PrivilegeElevationRequestSchema.parse(request);

    const response = await fetch(`${this.baseUrl}/elevate/request`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to request privilege elevation');
    }

    return response.json();
  }

  // Approve privilege elevation (admin only)
  async approvePrivilegeElevation(
    requestId: string, 
    approvalReason: string,
    conditions?: {
      requireMFA?: boolean;
      sessionTimeLimit?: number;
      ipRestriction?: string[];
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/elevate/approve/${requestId}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approvalReason,
        conditions,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve privilege elevation');
    }
  }

  // Deny privilege elevation (admin only)
  async denyPrivilegeElevation(requestId: string, denialReason: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/elevate/deny/${requestId}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        denialReason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to deny privilege elevation');
    }
  }

  // Assign role to user (admin only)
  async assignRole(
    userId: string, 
    role: Role, 
    reason: string,
    temporary?: {
      duration: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/role/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        role,
        reason,
        temporary,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to assign role');
    }
  }

  // Revoke role from user (admin only)
  async revokeRole(userId: string, reason: string, emergency = false): Promise<void> {
    const response = await fetch(`${this.baseUrl}/role/revoke`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        reason,
        emergency,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to revoke role');
    }
  }

  // Grant specific privilege (super admin only)
  async grantPrivilege(
    userId: string, 
    privilege: Privilege, 
    reason: string,
    temporary?: {
      duration: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/privilege/grant`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        privilege,
        reason,
        temporary,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to grant privilege');
    }
  }

  // Revoke specific privilege (super admin only)
  async revokePrivilege(userId: string, privilege: Privilege, reason: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/privilege/revoke`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        privilege,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to revoke privilege');
    }
  }

  // Emergency privilege revocation (super admin only)
  async emergencyRevokeAllPrivileges(userId: string, reason: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/emergency/revoke-all`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to perform emergency revocation');
    }
  }

  // Suspend user account (admin only)
  async suspendUser(userId: string, reason: string, duration?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user/suspend`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        reason,
        duration,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to suspend user');
    }
  }

  // Restore user account (admin only)
  async restoreUser(userId: string, reason: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/user/restore`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to restore user');
    }
  }

  // Get privilege audit log
  async getPrivilegeAuditLog(
    filters?: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: PrivilegeAuditEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${this.baseUrl}/audit?${params}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit log: ${response.statusText}`);
    }

    return response.json();
  }

  // Get pending privilege requests
  async getPendingPrivilegeRequests(): Promise<PrivilegeElevationRequest[]> {
    const response = await fetch(`${this.baseUrl}/elevate/pending`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pending requests: ${response.statusText}`);
    }

    return response.json();
  }

  // Bulk operations for privilege management
  async bulkAssignRole(
    userIds: string[], 
    role: Role, 
    reason: string
  ): Promise<{ successful: string[]; failed: { userId: string; error: string }[] }> {
    const response = await fetch(`${this.baseUrl}/bulk/assign-role`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds,
        role,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to perform bulk role assignment');
    }

    return response.json();
  }

  async bulkRevokeRole(
    userIds: string[], 
    reason: string
  ): Promise<{ successful: string[]; failed: { userId: string; error: string }[] }> {
    const response = await fetch(`${this.baseUrl}/bulk/revoke-role`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to perform bulk role revocation');
    }

    return response.json();
  }
}

// Custom hook for privilege management
export function usePrivilegeManagement() {
  const { showSuccess, showError, showWarning } = useToastHelpers();
  const { handleError } = useErrorHandler();
  const service = PrivilegeManagementService.getInstance();

  const assignRole = async (
    userId: string, 
    role: Role, 
    reason: string,
    temporary?: { duration: string; expiresAt: Date }
  ) => {
    try {
      await service.assignRole(userId, role, reason, temporary);
      showSuccess(
        'Role Assigned', 
        `Successfully assigned ${role} role${temporary ? ' (temporary)' : ''}`
      );
    } catch (error) {
      handleError(error, 'Assign Role');
    }
  };

  const revokeRole = async (userId: string, reason: string, emergency = false) => {
    try {
      await service.revokeRole(userId, reason, emergency);
      showSuccess(
        emergency ? 'Emergency Revocation' : 'Role Revoked', 
        'Successfully revoked user role'
      );
    } catch (error) {
      handleError(error, emergency ? 'Emergency Revoke Role' : 'Revoke Role');
    }
  };

  const requestElevation = async (request: PrivilegeElevationRequest) => {
    try {
      const result = await service.requestPrivilegeElevation(request);
      showSuccess(
        'Elevation Requested', 
        'Your privilege elevation request has been submitted for approval'
      );
      return result;
    } catch (error) {
      handleError(error, 'Request Privilege Elevation');
      return null;
    }
  };

  const approveElevation = async (requestId: string, reason: string) => {
    try {
      await service.approvePrivilegeElevation(requestId, reason);
      showSuccess(
        'Elevation Approved', 
        'Privilege elevation request has been approved'
      );
    } catch (error) {
      handleError(error, 'Approve Elevation');
    }
  };

  const denyElevation = async (requestId: string, reason: string) => {
    try {
      await service.denyPrivilegeElevation(requestId, reason);
      showWarning(
        'Elevation Denied', 
        'Privilege elevation request has been denied'
      );
    } catch (error) {
      handleError(error, 'Deny Elevation');
    }
  };

  const emergencyRevoke = async (userId: string, reason: string) => {
    try {
      await service.emergencyRevokeAllPrivileges(userId, reason);
      showWarning(
        'Emergency Revocation', 
        'All privileges have been immediately revoked from user'
      );
    } catch (error) {
      handleError(error, 'Emergency Revoke');
    }
  };

  const suspendUser = async (userId: string, reason: string, duration?: string) => {
    try {
      await service.suspendUser(userId, reason, duration);
      showWarning(
        'User Suspended', 
        `User account has been suspended${duration ? ` for ${duration}` : ''}`
      );
    } catch (error) {
      handleError(error, 'Suspend User');
    }
  };

  const restoreUser = async (userId: string, reason: string) => {
    try {
      await service.restoreUser(userId, reason);
      showSuccess(
        'User Restored', 
        'User account has been restored'
      );
    } catch (error) {
      handleError(error, 'Restore User');
    }
  };

  const bulkAssignRole = async (userIds: string[], role: Role, reason: string) => {
    try {
      const result = await service.bulkAssignRole(userIds, role, reason);
      if (result.failed.length > 0) {
        showWarning(
          'Partial Success',
          `Assigned role to ${result.successful.length} users, ${result.failed.length} failed`
        );
      } else {
        showSuccess(
          'Bulk Assignment Complete',
          `Successfully assigned ${role} role to ${result.successful.length} users`
        );
      }
      return result;
    } catch (error) {
      handleError(error, 'Bulk Assign Role');
      return null;
    }
  };

  return {
    service,
    assignRole,
    revokeRole,
    requestElevation,
    approveElevation,
    denyElevation,
    emergencyRevoke,
    suspendUser,
    restoreUser,
    bulkAssignRole,
  };
}