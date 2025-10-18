// Role-Based UI Components
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  UserWithPrivileges, 
  Privilege, 
  Role, 
  RBACManager,
  ROLE_HIERARCHY 
} from '../lib/rbac';
import { PrivilegeManagementService } from '../hooks/usePrivilegeManagement';

// RBAC Context
interface RBACContextType {
  currentUser: UserWithPrivileges | null;
  loading: boolean;
  error: string | null;
  hasPrivilege: (privilege: Privilege) => boolean;
  canManageUser: (targetUser: UserWithPrivileges) => boolean;
  canAssignRole: (role: Role) => boolean;
  refreshPrivileges: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

// RBAC Provider Component
interface RBACProviderProps {
  children: React.ReactNode;
}

export function RBACProvider({ children }: RBACProviderProps): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<UserWithPrivileges | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const privilegeService = PrivilegeManagementService.getInstance();

  const loadCurrentUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = await privilegeService.getCurrentUserPrivileges();
      setCurrentUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user privileges');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const hasPrivilege = (privilege: Privilege): boolean => {
    if (!currentUser) return false;
    return RBACManager.hasPrivilege(currentUser, privilege);
  };

  const canManageUser = (targetUser: UserWithPrivileges): boolean => {
    if (!currentUser) return false;
    return RBACManager.canManageUser(currentUser, targetUser);
  };

  const canAssignRole = (role: Role): boolean => {
    if (!currentUser) return false;
    return RBACManager.canAssignRole(currentUser, role);
  };

  const value: RBACContextType = {
    currentUser,
    loading,
    error,
    hasPrivilege,
    canManageUser,
    canAssignRole,
    refreshPrivileges: loadCurrentUser,
  };

  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  );
}

// Hook to use RBAC context
export function useRBAC(): RBACContextType {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
}

// Privilege Guard Component - Only renders children if user has privilege
interface PrivilegeGuardProps {
  privilege: Privilege | Privilege[];
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have ALL privileges; if false, ANY privilege
  children: React.ReactNode;
}

export function PrivilegeGuard({ 
  privilege, 
  fallback = null, 
  requireAll = false, 
  children 
}: PrivilegeGuardProps): React.ReactElement | null {
  const { hasPrivilege, loading } = useRBAC();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>;
  }

  const privileges = Array.isArray(privilege) ? privilege : [privilege];
  
  const hasAccess = requireAll
    ? privileges.every(p => hasPrivilege(p))
    : privileges.some(p => hasPrivilege(p));

  if (!hasAccess) {
    return fallback as React.ReactElement | null;
  }

  return <>{children}</>;
}

// Role Guard Component - Only renders children if user has specific role or higher
interface RoleGuardProps {
  role: Role | Role[];
  fallback?: React.ReactNode;
  exactMatch?: boolean; // If true, must have exact role; if false, role or higher
  children: React.ReactNode;
}

export function RoleGuard({ 
  role, 
  fallback = null, 
  exactMatch = false, 
  children 
}: RoleGuardProps): React.ReactElement | null {
  const { currentUser, loading } = useRBAC();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>;
  }

  if (!currentUser) {
    return fallback as React.ReactElement | null;
  }

  const roles = Array.isArray(role) ? role : [role];

  const hasAccess = exactMatch
    ? roles.includes(currentUser.role)
    : roles.some(r => ROLE_HIERARCHY[currentUser.role] >= ROLE_HIERARCHY[r]);

  if (!hasAccess) {
    return fallback as React.ReactElement | null;
  }

  return <>{children}</>;
}

// Admin Menu Component - Shows admin controls based on privileges
export function AdminMenu(): React.ReactElement | null {
  const { hasPrivilege, currentUser } = useRBAC();

  if (!currentUser || currentUser.role === 'user') {
    return null;
  }

  return (
    <details className="admin-menu relative">
      <summary className="nav-link cursor-pointer">
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Admin
          <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </summary>
      
      <div className="admin-submenu">
        <PrivilegeGuard privilege="users.view">
          <a href="/admin" className="submenu-link">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
              User Management
            </span>
          </a>
        </PrivilegeGuard>

        <PrivilegeGuard privilege="roles.view">
          <a href="/admin/roles" className="submenu-link">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Role Management
            </span>
          </a>
        </PrivilegeGuard>

        <PrivilegeGuard privilege="system.audit_logs">
          <a href="/admin/audit" className="submenu-link">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Audit Logs
            </span>
          </a>
        </PrivilegeGuard>

        <PrivilegeGuard privilege="system.settings">
          <a href="/admin/settings" className="submenu-link">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              System Settings
            </span>
          </a>
        </PrivilegeGuard>

        <PrivilegeGuard privilege={['emergency.suspend_user', 'roles.emergency_revoke']} requireAll={false}>
          <a href="/admin/emergency" className="submenu-link text-red-600">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Emergency Controls
            </span>
          </a>
        </PrivilegeGuard>
      </div>
    </details>
  );
}

// Privilege Badge Component - Shows user's current privilege level
export function PrivilegeBadge(): React.ReactElement | null {
  const { currentUser } = useRBAC();

  if (!currentUser || currentUser.role === 'user') {
    return null;
  }

  const roleInfo = RBACManager.getRoleInfo(currentUser.role);
  const badgeColors = {
    user: 'bg-gray-100 text-gray-800',
    team_lead: 'bg-blue-100 text-blue-800',
    manager: 'bg-green-100 text-green-800',
    admin: 'bg-orange-100 text-orange-800',
    super_admin: 'bg-red-100 text-red-800',
    auditor: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${badgeColors[currentUser.role]}
    `}>
      {roleInfo.name}
    </span>
  );
}

// Action Button with Privilege Check
interface PrivilegedActionButtonProps {
  privilege: Privilege | Privilege[];
  requireAll?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fallback?: React.ReactNode;
}

export function PrivilegedActionButton({
  privilege,
  requireAll = false,
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fallback = null,
}: PrivilegedActionButtonProps): React.ReactElement | null {
  const { hasPrivilege } = useRBAC();

  const privileges = Array.isArray(privilege) ? privilege : [privilege];
  const hasAccess = requireAll
    ? privileges.every(p => hasPrivilege(p))
    : privileges.some(p => hasPrivilege(p));

  if (!hasAccess) {
    return fallback as React.ReactElement | null;
  }

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200';
  
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
      `}
    >
      {children}
    </button>
  );
}

// Warning Banner for Elevated Privileges
export function ElevatedPrivilegeWarning(): React.ReactElement | null {
  const { currentUser } = useRBAC();

  if (!currentUser || !currentUser.temporaryElevations?.length) {
    return null;
  }

  const activeElevations = currentUser.temporaryElevations.filter(
    elevation => new Date(elevation.expiresAt) > new Date()
  );

  if (activeElevations.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Elevated Privileges Active
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>You currently have temporary elevated privileges:</p>
            <ul className="list-disc space-y-1 pl-5 mt-2">
              {activeElevations.map((elevation, index) => (
                <li key={index}>
                  <strong>{RBACManager.getPrivilegeInfo(elevation.privilege).name}</strong>
                  {' '}expires {new Date(elevation.expiresAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}