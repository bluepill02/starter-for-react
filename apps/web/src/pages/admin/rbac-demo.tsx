// RBAC Integration Demo Page - Demonstrates complete privilege management system
import React, { useState, useEffect } from 'react';
import { useRBAC, PrivilegeGuard, RoleGuard, ElevatedPrivilegeWarning, AdminMenu } from '../../components/RBAC';
import { usePrivilegeManagement } from '../../hooks/usePrivilegeManagement';
import { Role, Privilege, UserWithPrivileges } from '../../lib/rbac';
import { useToastHelpers } from '../../hooks/useToast';
import { Button } from '../../components/Form';

export default function RBACIntegrationDemo(): React.ReactElement {
  const { currentUser, hasPrivilege, canManageUser, canAssignRole } = useRBAC();
  const privilegeService = usePrivilegeManagement();
  const { showSuccess, showInfo, showWarning } = useToastHelpers();
  const [demoUser, setDemoUser] = useState<UserWithPrivileges | null>(null);

  // Demo functions to showcase RBAC features
  const demonstratePrivilegeCheck = (privilege: Privilege) => {
    const hasAccess = hasPrivilege(privilege);
    showInfo(
      'Privilege Check',
      `You ${hasAccess ? 'HAVE' : 'DO NOT HAVE'} the privilege: ${privilege}`
    );
  };

  const demonstrateRoleCheck = (role: Role) => {
    const hasAccess = currentUser?.role === role;
    showInfo(
      'Role Check',
      `You ${hasAccess ? 'HAVE' : 'DO NOT HAVE'} the role: ${role}`
    );
  };

  const demonstrateElevation = async () => {
    try {
      await privilegeService.requestElevation({
        userId: currentUser?.id || '',
        requestedRole: 'admin',
        reason: 'Demo: Testing privilege elevation workflow',
        duration: '1_hour',
        requestedBy: currentUser?.id || '',
        emergencyEscalation: false,
        requestedPrivileges: ['roles.assign'],
      });
      showSuccess('Elevation Request', 'Privilege elevation request submitted for approval');
    } catch (error) {
      console.error('Elevation demo error:', error);
    }
  };

  const demonstrateManagementCheck = () => {
    if (demoUser && currentUser) {
      const canManage = canManageUser(demoUser);
      showInfo(
        'User Management Check',
        `You ${canManage ? 'CAN' : 'CANNOT'} manage this user based on role hierarchy`
      );
    } else {
      showWarning('Demo Setup', 'Please select a demo user first');
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">Please log in to access the RBAC demo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <svg className="w-6 h-6 mr-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            RBAC System Integration Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Interactive demonstration of Role-Based Access Control features
          </p>
        </div>

        <div className="p-6">
          {/* User Context Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Your Current Context</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Name:</span>{' '}
                <span className="text-blue-900">{currentUser.displayName}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Role:</span>{' '}
                <span className="text-blue-900">{currentUser.role}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Active:</span>{' '}
                <span className="text-blue-900">{currentUser.isActive ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          <ElevatedPrivilegeWarning />

          {/* Demo Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Privilege Guards Demo */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Privilege Guards
              </h3>
              
              <div className="space-y-3">
                <PrivilegeGuard privilege="users.view">
                  <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800">
                    ✅ You can view users (users.view privilege)
                  </div>
                </PrivilegeGuard>

                <PrivilegeGuard privilege="users.create">
                  <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800">
                    ✅ You can create users (users.create privilege)
                  </div>
                </PrivilegeGuard>

                <PrivilegeGuard privilege="roles.assign">
                  <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800">
                    ✅ You can assign roles (roles.assign privilege)
                  </div>
                </PrivilegeGuard>

                <PrivilegeGuard privilege="system.backup">
                  <div className="p-3 bg-green-100 border border-green-300 rounded text-green-800">
                    ✅ You can modify system config (system.config privilege)
                  </div>
                </PrivilegeGuard>

                <div className="p-3 bg-gray-100 border border-gray-300 rounded text-gray-600">
                  💡 Hidden content shows only when you have the required privilege
                </div>
              </div>
            </div>

            {/* Role Guards Demo */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Role Guards
              </h3>
              
              <div className="space-y-3">
                <RoleGuard role="user">
                  <div className="p-3 bg-blue-100 border border-blue-300 rounded text-blue-800">
                    👤 User level access
                  </div>
                </RoleGuard>

                <RoleGuard role="team_lead">
                  <div className="p-3 bg-blue-100 border border-blue-300 rounded text-blue-800">
                    👥 Team Lead level access
                  </div>
                </RoleGuard>

                <RoleGuard role="manager">
                  <div className="p-3 bg-blue-100 border border-blue-300 rounded text-blue-800">
                    🏢 Manager level access
                  </div>
                </RoleGuard>

                <RoleGuard role="admin">
                  <div className="p-3 bg-blue-100 border border-blue-300 rounded text-blue-800">
                    ⚙️ Admin level access
                  </div>
                </RoleGuard>

                <RoleGuard role="super_admin">
                  <div className="p-3 bg-blue-100 border border-blue-300 rounded text-blue-800">
                    👑 Super Admin level access
                  </div>
                </RoleGuard>
              </div>
            </div>

            {/* Interactive Demo Controls */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Interactive Privilege Tests
              </h3>
              
              <div className="space-y-3">
                <Button
                  variant="primary"
                  onClick={() => demonstratePrivilegeCheck('users.view')}
                  className="w-full"
                >
                  Test: users.view Privilege
                </Button>

                <Button
                  variant="primary"
                  onClick={() => demonstratePrivilegeCheck('roles.assign')}
                  className="w-full"
                >
                  Test: roles.assign Privilege
                </Button>

                <Button
                  variant="primary"
                  onClick={() => demonstrateRoleCheck('admin')}
                  className="w-full"
                >
                  Test: Admin Role
                </Button>

                <Button
                  variant="secondary"
                  onClick={demonstrateElevation}
                  className="w-full"
                >
                  Request Privilege Elevation
                </Button>

                <Button
                  variant="secondary"
                  onClick={demonstrateManagementCheck}
                  className="w-full"
                >
                  Test User Management Check
                </Button>
              </div>
            </div>

            {/* Admin Menu Demo */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Contextual Admin Menu
              </h3>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This menu adapts based on your role and privileges:
                </p>
                <AdminMenu />
              </div>
            </div>
          </div>

          {/* Feature Summary */}
          <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-indigo-900 mb-4">🎯 RBAC System Features Demonstrated</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-indigo-800">
              <div>
                <h4 className="font-medium mb-2">Security & Access Control:</h4>
                <ul className="space-y-1 pl-4">
                  <li>• Privilege-based access guards</li>
                  <li>• Role hierarchy enforcement</li>
                  <li>• Server-side validation</li>
                  <li>• Privilege elevation workflows</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">User Experience:</h4>
                <ul className="space-y-1 pl-4">
                  <li>• Contextual UI components</li>
                  <li>• Graceful privilege warnings</li>
                  <li>• Adaptive admin interfaces</li>
                  <li>• Real-time privilege checks</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Auditability:</h4>
                <ul className="space-y-1 pl-4">
                  <li>• Complete audit trails</li>
                  <li>• Privilege change logging</li>
                  <li>• Emergency action tracking</li>
                  <li>• Review requirements</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Management:</h4>
                <ul className="space-y-1 pl-4">
                  <li>• Role assignment workflows</li>
                  <li>• Temporary privilege grants</li>
                  <li>• Emergency revocation</li>
                  <li>• Bulk operations support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}