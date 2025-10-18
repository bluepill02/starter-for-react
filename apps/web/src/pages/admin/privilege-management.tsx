// Admin Privilege Management Page
import React, { useState, useEffect } from 'react';
import { 
  UserWithPrivileges, 
  Role, 
  Privilege, 
  PrivilegeElevationRequest,
  PrivilegeAuditEvent,
  RBACManager 
} from '../../lib/rbac';
import { usePrivilegeManagement } from '../../hooks/usePrivilegeManagement';
import { useRBAC, PrivilegeGuard, ElevatedPrivilegeWarning } from '../../components/RBAC';
import { FormField, TextInput, TextArea, Select, Button, Form } from '../../components/Form';
import { useToastHelpers } from '../../hooks/useToast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { z } from 'zod';

// Role assignment form schema
const roleAssignmentSchema = z.object({
  userId: z.string().min(1, 'Please select a user'),
  role: z.string().min(1, 'Please select a role'),
  reason: z.string().min(20, 'Please provide a detailed reason (minimum 20 characters)'),
  temporary: z.boolean().default(false),
  duration: z.string().optional(),
});

type RoleAssignmentForm = z.infer<typeof roleAssignmentSchema>;

export default function AdminPrivilegeManagementPage(): React.ReactElement {
  const [users, setUsers] = useState<UserWithPrivileges[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PrivilegeElevationRequest[]>([]);
  const [auditEvents, setAuditEvents] = useState<PrivilegeAuditEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithPrivileges | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'audit'>('users');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);

  const { currentUser, hasPrivilege, canManageUser, canAssignRole } = useRBAC();
  const privilegeService = usePrivilegeManagement();
  const { showSuccess, showError, showWarning } = useToastHelpers();
  const { handleError, validateAndHandle } = useErrorHandler();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, requestsData, auditData] = await Promise.all([
        privilegeService.service.getAllUsersWithPrivileges(),
        privilegeService.service.getPendingPrivilegeRequests(),
        privilegeService.service.getPrivilegeAuditLog({ limit: 50 }),
      ]);
      
      setUsers(usersData);
      setPendingRequests(requestsData);
      setAuditEvents(auditData.events);
    } catch (error) {
      handleError(error, 'Load privilege data');
    } finally {
      setLoading(false);
    }
  };

  // Handle role assignment
  const handleRoleAssignment = async (formData: RoleAssignmentForm) => {
    if (!selectedUser) return;

    try {
      const validatedData = validateAndHandle(roleAssignmentSchema, formData);
      if (!validatedData) return;

      const temporary = validatedData.temporary && validatedData.duration ? {
        duration: validatedData.duration,
        expiresAt: new Date(Date.now() + parseInt(validatedData.duration) * 1000),
      } : undefined;

      await privilegeService.assignRole(
        validatedData.userId,
        validatedData.role as Role,
        validatedData.reason,
        temporary
      );

      setShowRoleAssignment(false);
      setSelectedUser(null);
      await loadData();
    } catch (error) {
      handleError(error, 'Assign role');
    }
  };

  // Handle emergency revocation
  const handleEmergencyRevoke = async (userId: string, reason: string) => {
    if (!reason.trim()) {
      showError('Missing reason', 'Please provide a reason for emergency revocation');
      return;
    }

    try {
      await privilegeService.emergencyRevoke(userId, reason);
      setShowEmergencyPanel(false);
      await loadData();
    } catch (error) {
      handleError(error, 'Emergency revoke');
    }
  };

  // Handle user suspension
  const handleSuspendUser = async (userId: string, reason: string, duration?: string) => {
    try {
      await privilegeService.suspendUser(userId, reason, duration);
      await loadData();
    } catch (error) {
      handleError(error, 'Suspend user');
    }
  };

  // Handle privilege request approval/denial
  const handleRequestApproval = async (requestId: string, approved: boolean, reason: string) => {
    try {
      if (approved) {
        await privilegeService.approveElevation(requestId, reason);
      } else {
        await privilegeService.denyElevation(requestId, reason);
      }
      await loadData();
    } catch (error) {
      handleError(error, approved ? 'Approve request' : 'Deny request');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <svg className="w-6 h-6 mr-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Privilege Management
          </h1>
          <p className="mt-2 text-gray-600">
            Manage user roles, privileges, and access control with full audit trail
          </p>
        </div>

        <ElevatedPrivilegeWarning />

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Users & Roles ({users.length})
              </span>
            </button>
            
            <PrivilegeGuard privilege="roles.assign">
              <button
                onClick={() => setActiveTab('requests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'requests'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                  </svg>
                  Pending Requests
                  {pendingRequests.length > 0 && (
                    <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                      {pendingRequests.length}
                    </span>
                  )}
                </span>
              </button>
            </PrivilegeGuard>

            <PrivilegeGuard privilege="system.audit_logs">
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Audit Trail
                </span>
              </button>
            </PrivilegeGuard>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'users' && (
            <UserManagementTab
              users={users}
              currentUser={currentUser}
              canManageUser={canManageUser}
              canAssignRole={canAssignRole}
              onSelectUser={setSelectedUser}
              onShowRoleAssignment={() => setShowRoleAssignment(true)}
              onSuspendUser={handleSuspendUser}
              onShowEmergency={() => setShowEmergencyPanel(true)}
            />
          )}

          {activeTab === 'requests' && (
            <PrivilegeRequestsTab
              requests={pendingRequests}
              onApproveRequest={handleRequestApproval}
            />
          )}

          {activeTab === 'audit' && (
            <AuditTrailTab
              events={auditEvents}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>

      {/* Role Assignment Modal */}
      {showRoleAssignment && selectedUser && (
        <RoleAssignmentModal
          user={selectedUser}
          canAssignRole={canAssignRole}
          onAssign={handleRoleAssignment}
          onClose={() => {
            setShowRoleAssignment(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Emergency Panel Modal */}
      {showEmergencyPanel && selectedUser && (
        <EmergencyActionsModal
          user={selectedUser}
          onEmergencyRevoke={handleEmergencyRevoke}
          onClose={() => {
            setShowEmergencyPanel(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

// User Management Tab Component
interface UserManagementTabProps {
  users: UserWithPrivileges[];
  currentUser: UserWithPrivileges | null;
  canManageUser: (user: UserWithPrivileges) => boolean;
  canAssignRole: (role: Role) => boolean;
  onSelectUser: (user: UserWithPrivileges) => void;
  onShowRoleAssignment: () => void;
  onSuspendUser: (userId: string, reason: string, duration?: string) => void;
  onShowEmergency: () => void;
}

function UserManagementTab({
  users,
  currentUser,
  canManageUser,
  canAssignRole,
  onSelectUser,
  onShowRoleAssignment,
  onSuspendUser,
  onShowEmergency,
}: UserManagementTabProps): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            title="Filter users by role"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="team_lead">Team Lead</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                    user.role === 'admin' ? 'bg-orange-100 text-orange-800' :
                    user.role === 'manager' ? 'bg-green-100 text-green-800' :
                    user.role === 'team_lead' ? 'bg-blue-100 text-blue-800' :
                    user.role === 'auditor' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {RBACManager.getRoleInfo(user.role).name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {canManageUser(user) && (
                    <>
                      <PrivilegeGuard privilege="roles.assign">
                        <button
                          onClick={() => {
                            onSelectUser(user);
                            onShowRoleAssignment();
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Manage Role
                        </button>
                      </PrivilegeGuard>
                      
                      <PrivilegeGuard privilege="roles.emergency_revoke">
                        <button
                          onClick={() => {
                            onSelectUser(user);
                            onShowEmergency();
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Emergency
                        </button>
                      </PrivilegeGuard>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Role Assignment Modal Component
interface RoleAssignmentModalProps {
  user: UserWithPrivileges;
  canAssignRole: (role: Role) => boolean;
  onAssign: (formData: RoleAssignmentForm) => void;
  onClose: () => void;
}

function RoleAssignmentModal({
  user,
  canAssignRole,
  onAssign,
  onClose,
}: RoleAssignmentModalProps): React.ReactElement {
  const [formData, setFormData] = useState<Partial<RoleAssignmentForm>>({
    userId: user.id,
    role: user.role,
    reason: '',
    temporary: false,
    duration: '3600', // 1 hour default
  });

  const availableRoles: Role[] = ['user', 'team_lead', 'manager', 'admin', 'super_admin', 'auditor']
    .filter(role => canAssignRole(role as Role)) as Role[];
  const durationOptions = [
    { value: '3600', label: '1 Hour' },
    { value: '28800', label: '8 Hours' },
    { value: '86400', label: '24 Hours' },
    { value: '604800', label: '7 Days' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(formData as RoleAssignmentForm);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Assign Role to {user.displayName}
          </h3>
          
          <Form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <FormField label="New Role" required>
                <Select
                  value={formData.role || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  options={availableRoles.map(role => ({
                    value: role,
                    label: RBACManager.getRoleInfo(role).name,
                  }))}
                  placeholder="Select a role"
                />
              </FormField>

              <FormField label="Reason" required>
                <TextArea
                  value={formData.reason || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Provide a detailed reason for this role assignment..."
                  rows={3}
                />
              </FormField>

              <FormField label="Temporary Assignment">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.temporary || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, temporary: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    This is a temporary role assignment
                  </span>
                </label>
              </FormField>

              {formData.temporary && (
                <FormField label="Duration">
                  <Select
                    value={formData.duration || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    options={durationOptions}
                  />
                </FormField>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Assign Role
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other tabs
function PrivilegeRequestsTab({ requests, onApproveRequest }: any): React.ReactElement {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">Privilege requests management interface</p>
      <p className="text-sm text-gray-400 mt-2">
        {requests.length} pending requests
      </p>
    </div>
  );
}

function AuditTrailTab({ events, onRefresh }: any): React.ReactElement {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">Audit trail interface</p>
      <p className="text-sm text-gray-400 mt-2">
        {events.length} recent events
      </p>
    </div>
  );
}

function EmergencyActionsModal({ user, onEmergencyRevoke, onClose }: any): React.ReactElement {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-red-600 mb-4">
            Emergency Actions for {user.displayName}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Emergency Action
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide detailed reason for emergency action..."
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="danger"
                onClick={() => onEmergencyRevoke(user.id, reason)}
                disabled={!reason.trim()}
              >
                Emergency Revoke All
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}