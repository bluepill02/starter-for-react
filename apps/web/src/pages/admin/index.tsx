// Team Page and Admin Workspace - Production Implementation
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  description: string;
  requiresRole?: 'ADMIN' | 'MANAGER';
}

export default function AdminLayout({ children }: AdminLayoutProps): React.ReactElement {
  const { currentUser, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useI18n;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditTimelineOpen, setAuditTimelineOpen] = useState(false);

  // Navigation items for admin workspace
  const navigationItems: NavigationItem[] = [
    {
      id: 'verify',
      label: 'Verify Recognitions',
      icon: '✅',
      path: '/admin/verify',
      description: 'Review and verify pending recognitions',
      requiresRole: 'MANAGER'
    },
    {
      id: 'privilege-management',
      label: 'Privilege Management',
      icon: '🔐',
      path: '/admin/privilege-management',
      description: 'Manage user roles, privileges, and access control',
      requiresRole: 'ADMIN'
    },
    {
      id: 'audit-dashboard',
      label: 'Audit Dashboard',
      icon: '📋',
      path: '/admin/audit-dashboard',
      description: 'View comprehensive audit logs and security events',
      requiresRole: 'ADMIN'
    },
    {
      id: 'abuse',
      label: 'Abuse Review',
      icon: '🚨',
      path: '/admin/abuse',
      description: 'Review flagged content and manage abuse cases',
      requiresRole: 'ADMIN'
    },
    {
      id: 'analytics',
      label: 'Analytics Dashboard',
      icon: '📊',
      path: '/admin/analytics',
      description: 'View team insights, metrics, and SLO health',
      requiresRole: 'MANAGER'
    },
    {
      id: 'rbac-demo',
      label: 'RBAC Demo',
      icon: '🎯',
      path: '/admin/rbac-demo',
      description: 'Interactive demonstration of Role-Based Access Control',
      requiresRole: 'ADMIN'
    },
    {
      id: 'growth',
      label: 'Growth & Insights',
      icon: '🚀',
      path: '/admin/growth',
      description: 'Monitor team growth and engagement metrics',
      requiresRole: 'MANAGER'
    }
  ];

  // Filter navigation based on user role
  const visibleItems = navigationItems.filter(item => 
    !item.requiresRole || hasRole(item.requiresRole)
  );

  // Access control
  if (!currentUser || (!hasRole('MANAGER') && !hasRole('ADMIN'))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">🚫</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-4">
              Manager or Administrator access is required to view this workspace.
            </p>
            <button
              onClick={() => navigate('/feed')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-slate-800 text-white">
          <h1 className="text-lg font-semibold">Admin Workspace</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-slate-700"
            aria-label="Close sidebar"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-3 text-left text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 border-l-4 border-slate-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="text-lg mr-3" role="img" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Audit Timeline Widget */}
        <div className="absolute bottom-4 left-3 right-3">
          <div className="bg-slate-50 rounded-lg border border-slate-200">
            <button
              onClick={() => setAuditTimelineOpen(!auditTimelineOpen)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center">
                <span className="text-sm text-slate-600 mr-2">📋</span>
                <span className="text-sm font-medium text-slate-700">Audit Trail</span>
              </div>
              <span className={`text-slate-400 transition-transform ${auditTimelineOpen ? 'rotate-180' : ''}`}>
                ↓
              </span>
            </button>
            
            {auditTimelineOpen && (
              <div className="px-3 pb-3">
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Recognition verified</span>
                      <span>2m ago</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Flag resolved</span>
                      <span>15m ago</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Export generated</span>
                      <span>1h ago</span>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700">
                  View full audit log →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="Open sidebar"
            >
              <span className="text-xl">☰</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Admin Workspace</h1>
            <div></div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}