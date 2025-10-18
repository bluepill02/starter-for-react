// Audit Dashboard Page - Comprehensive audit log management
import React, { useState, useEffect, useMemo } from 'react';
import { 
  PrivilegeAuditEvent, 
  Role,
  RBACManager 
} from '../../lib/rbac';
import { usePrivilegeManagement } from '../../hooks/usePrivilegeManagement';
import { PrivilegeGuard } from '../../components/RBAC';
import { FormField, TextInput, Select, Button, Form } from '../../components/Form';
import { useToastHelpers } from '../../hooks/useToast';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { z } from 'zod';

// Audit search filters schema
const auditFiltersSchema = z.object({
  eventType: z.string().optional(),
  userId: z.string().optional(),
  adminId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  searchTerm: z.string().optional(),
});

type AuditFilters = z.infer<typeof auditFiltersSchema>;

interface AuditEventWithDetails extends PrivilegeAuditEvent {
  userDisplayName?: string;
  adminDisplayName?: string;
  targetDisplayName?: string;
}

export default function AuditDashboardPage(): React.ReactElement {
  const [auditEvents, setAuditEvents] = useState<AuditEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [selectedEvent, setSelectedEvent] = useState<AuditEventWithDetails | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const privilegeService = usePrivilegeManagement();
  const { showSuccess, showError } = useToastHelpers();
  const { handleError, validateAndHandle } = useErrorHandler();

  const pageSize = 50;

  // Load audit events with filters
  useEffect(() => {
    loadAuditEvents();
  }, [currentPage, filters]);

  const loadAuditEvents = async () => {
    try {
      setLoading(true);
      const response = await privilegeService.service.getPrivilegeAuditLog({
        offset: (currentPage - 1) * pageSize,
        limit: pageSize,
        ...filters,
      });

      setAuditEvents(response.events);
      setTotalPages(Math.ceil(response.total / pageSize));
      setTotalEvents(response.total);
    } catch (error) {
      handleError(error, 'Load audit events');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: AuditFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Handle export
  const handleExport = async () => {
    try {
      // For now, just export the current data as CSV/JSON
      const dataToExport = auditEvents.map(event => ({
        timestamp: event.timestamp,
        action: event.action,
        subjectUserId: event.subjectUserId,
        actorUserId: event.actorUserId,
        reason: event.reason,
        metadata: event.metadata,
      }));

      let exportData: string;
      if (exportFormat === 'csv') {
        // Convert to CSV
        const headers = Object.keys(dataToExport[0] || {});
        const csvRows = [
          headers.join(','),
          ...dataToExport.map(row => 
            headers.map(header => JSON.stringify(row[header as keyof typeof row] || '')).join(',')
          )
        ];
        exportData = csvRows.join('\n');
      } else {
        exportData = JSON.stringify(dataToExport, null, 2);
      }

      // Create download link
      const blob = new Blob([exportData], { 
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      link.click();
      URL.revokeObjectURL(url);

      showSuccess('Export completed', `Audit log exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      handleError(error, 'Export audit log');
    }
  };

  // Filter event types for dropdown
  const eventTypeOptions = [
    { value: '', label: 'All Event Types' },
    { value: 'role_assigned', label: 'Role Assigned' },
    { value: 'role_revoked', label: 'Role Revoked' },
    { value: 'privilege_elevated', label: 'Privilege Elevated' },
    { value: 'privilege_revoked', label: 'Privilege Revoked' },
    { value: 'emergency_revoke', label: 'Emergency Revoke' },
    { value: 'user_suspended', label: 'User Suspended' },
    { value: 'user_reactivated', label: 'User Reactivated' },
    { value: 'bulk_operation', label: 'Bulk Operation' },
    { value: 'login_attempt', label: 'Login Attempt' },
    { value: 'session_terminated', label: 'Session Terminated' },
  ];

  // Pagination component
  const Pagination = () => (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="secondary"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing{' '}
            <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
            {' '}to{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, totalEvents)}
            </span>
            {' '}of{' '}
            <span className="font-medium">{totalEvents}</span>
            {' '}results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-l-md"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + Math.max(1, currentPage - 2);
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "primary" : "secondary"}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="secondary"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-r-md"
            >
              Next
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );

  if (loading && auditEvents.length === 0) {
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <svg className="w-6 h-6 mr-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Audit Trail Dashboard
              </h1>
              <p className="mt-2 text-gray-600">
                Complete audit log of all privilege and security events
              </p>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
              
              <PrivilegeGuard privilege="system.audit_logs">
                <Button
                  variant="primary"
                  onClick={handleExport}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Export
                </Button>
              </PrivilegeGuard>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <AuditFiltersForm
              initialFilters={filters}
              eventTypeOptions={eventTypeOptions}
              onFiltersChange={handleFilterChange}
              onReset={() => handleFilterChange({})}
            />
          </div>
        )}

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">{totalEvents}</p>
              <p className="text-sm text-gray-600">Total Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-orange-600">
                {auditEvents.filter(e => e.action === 'emergency_revoke').length}
              </p>
              <p className="text-sm text-gray-600">Emergency Actions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-green-600">
                {auditEvents.filter(e => e.action === 'role_assigned').length}
              </p>
              <p className="text-sm text-gray-600">Role Assignments</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-blue-600">
                {auditEvents.filter(e => e.action === 'privilege_granted').length}
              </p>
              <p className="text-sm text-gray-600">Privilege Grants</p>
            </div>
          </div>
        </div>

        {/* Audit Events Table */}
        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading audit events...</p>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No audit events found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditEvents.map((event) => (
                    <AuditEventRow
                      key={event.id}
                      event={event}
                      onViewDetails={() => setSelectedEvent(event)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && <Pagination />}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <AuditEventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// Audit Filters Form Component
interface AuditFiltersFormProps {
  initialFilters: AuditFilters;
  eventTypeOptions: { value: string; label: string }[];
  onFiltersChange: (filters: AuditFilters) => void;
  onReset: () => void;
}

function AuditFiltersForm({
  initialFilters,
  eventTypeOptions,
  onFiltersChange,
  onReset,
}: AuditFiltersFormProps): React.ReactElement {
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange(filters);
  };

  const handleReset = () => {
    setFilters({});
    onReset();
  };

  return (
    <Form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <FormField label="Event Type">
          <Select
            value={filters.eventType || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value || undefined }))}
            options={eventTypeOptions}
          />
        </FormField>

        <FormField label="Start Date">
          <TextInput
            type="datetime-local"
            value={filters.startDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
          />
        </FormField>

        <FormField label="End Date">
          <TextInput
            type="datetime-local"
            value={filters.endDate || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
          />
        </FormField>

        <FormField label="Search">
          <TextInput
            placeholder="Search users, events..."
            value={filters.searchTerm || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value || undefined }))}
          />
        </FormField>

        <div className="flex items-end space-x-2">
          <Button type="submit" variant="primary">
            Apply
          </Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>
    </Form>
  );
}

// Audit Event Row Component
interface AuditEventRowProps {
  event: AuditEventWithDetails;
  onViewDetails: () => void;
}

function AuditEventRow({ event, onViewDetails }: AuditEventRowProps): React.ReactElement {
  const getEventTypeStyle = (action: string) => {
    switch (action) {
      case 'emergency_revoke':
        return 'bg-red-100 text-red-800';
      case 'role_assigned':
      case 'privilege_granted':
        return 'bg-green-100 text-green-800';
      case 'role_revoked':
      case 'privilege_revoked':
        return 'bg-orange-100 text-orange-800';
      case 'session_elevated':
        return 'bg-yellow-100 text-yellow-800';
      case 'elevation_requested':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'emergency_revoke':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'role_assigned':
      case 'privilege_granted':
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex flex-col">
          <span>{new Date(event.timestamp).toLocaleDateString()}</span>
          <span className="text-xs text-gray-500">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {getEventIcon(event.action)}
          <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEventTypeStyle(event.action)}`}>
            {event.action.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {event.userDisplayName || event.subjectUserId || 'System'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {event.adminDisplayName || event.actorUserId || 'System'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
        {event.reason || event.metadata?.reason || 'No details provided'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={onViewDetails}
          className="text-indigo-600 hover:text-indigo-900"
        >
          View Details
        </button>
      </td>
    </tr>
  );
}

// Event Details Modal Component
interface AuditEventDetailsModalProps {
  event: AuditEventWithDetails;
  onClose: () => void;
}

function AuditEventDetailsModal({ event, onClose }: AuditEventDetailsModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Audit Event Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              title="Close dialog"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Event ID</label>
                <p className="text-sm text-gray-900 font-mono">{event.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                <p className="text-sm text-gray-900">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Type</label>
                <p className="text-sm text-gray-900">{event.action}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Requires Review</label>
                <p className="text-sm text-gray-900">{event.requiresReview ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">User</label>
                <p className="text-sm text-gray-900">
                  {event.userDisplayName || event.subjectUserId || 'System'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Admin</label>
                <p className="text-sm text-gray-900">
                  {event.adminDisplayName || event.actorUserId || 'System'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                {event.reason || 'No reason provided'}
              </p>
            </div>

            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metadata</label>
                <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}