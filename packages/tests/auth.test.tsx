
// @ts-nocheck
/// <reference path="./types/jest.d.ts" />

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth, RequireRole, RequireAuth } from '../../apps/web/src/lib/auth';

// Mock Appwrite SDK
const mockAccount = {
  get: jest.fn() as jest.MockedFunction<any>,
  getSession: jest.fn() as jest.MockedFunction<any>,
  createOAuth2Session: jest.fn() as jest.MockedFunction<any>,
  createEmailPasswordSession: jest.fn() as jest.MockedFunction<any>,
  create: jest.fn() as jest.MockedFunction<any>,
  deleteSession: jest.fn() as jest.MockedFunction<any>,
};

// Mock the Appwrite client
jest.mock('../../apps/web/src/appwrite/client', () => ({
  getAccount: () => mockAccount,
}));

// Mock window.location  
const mockLocation = {
  href: 'http://localhost',
  origin: 'http://localhost',
  pathname: '/',
  search: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock window.location
delete (window as any).location;
window.location = mockLocation as any;

// Mock window.history
Object.defineProperty(window, 'history', {
  value: {
    replaceState: jest.fn(),
  },
  writable: true,
});

// Test component to use auth hook
function TestAuthComponent() {
  const {
    currentUser,
    session,
    loading,
    signInWithOAuth,
    signInWithEmail,
    signUp,
    signOut,
    isManager,
    isAdmin,
    hasRole,
    refreshUser,
  } = useAuth();

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="user-info">
        {currentUser ? (
          <>
            <span data-testid="user-name">{currentUser.name}</span>
            <span data-testid="user-role">{currentUser.role}</span>
            <span data-testid="user-email">{currentUser.email}</span>
          </>
        ) : (
          <span data-testid="not-authenticated">Not authenticated</span>
        )}
      </div>
      <div data-testid="session-info">
        {session ? <span data-testid="has-session">Has session</span> : <span data-testid="no-session">No session</span>}
      </div>
      <div data-testid="role-checks">
        <span data-testid="is-manager">{isManager() ? 'true' : 'false'}</span>
        <span data-testid="is-admin">{isAdmin() ? 'true' : 'false'}</span>
        <span data-testid="has-user-role">{hasRole('USER') ? 'true' : 'false'}</span>
        <span data-testid="has-manager-role">{hasRole('MANAGER') ? 'true' : 'false'}</span>
        <span data-testid="has-admin-role">{hasRole('ADMIN') ? 'true' : 'false'}</span>
      </div>
      <div data-testid="auth-actions">
        <button onClick={() => signInWithOAuth('google')} data-testid="oauth-google">
          Sign in with Google
        </button>
        <button onClick={() => signInWithOAuth('microsoft')} data-testid="oauth-microsoft">
          Sign in with Microsoft
        </button>
        <button onClick={() => signInWithEmail('test@example.com', 'password')} data-testid="email-signin">
          Sign in with Email
        </button>
        <button onClick={() => signUp('test@example.com', 'password', 'Test User')} data-testid="signup">
          Sign Up
        </button>
        <button onClick={() => signOut()} data-testid="signout">
          Sign Out
        </button>
        <button onClick={() => refreshUser()} data-testid="refresh">
          Refresh User
        </button>
      </div>
    </div>
  );
}

// Test component for RequireRole
function TestRequireRole() {
  return (
    <AuthProvider>
      <RequireRole
        role="ADMIN"
        fallback={<div data-testid="access-denied">Access Denied</div>}
      >
        <div data-testid="admin-content">Admin Content</div>
      </RequireRole>
    </AuthProvider>
  );
}

// Test component for RequireAuth
function TestRequireAuth() {
  return (
    <AuthProvider>
      <RequireAuth fallback={<div data-testid="login-required">Login Required</div>}>
        <div data-testid="protected-content">Protected Content</div>
      </RequireAuth>
    </AuthProvider>
  );
}

describe('Auth System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthProvider and useAuth Hook', () => {
    it('should show loading state initially', async () => {
      mockAccount.get.mockRejectedValue(new Error('Not authenticated'));
      mockAccount.getSession.mockRejectedValue(new Error('No session'));

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('should handle unauthenticated state', async () => {
      mockAccount.get.mockRejectedValue(new Error('Not authenticated'));
      mockAccount.getSession.mockRejectedValue(new Error('No session'));

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('not-authenticated')).toBeInTheDocument();
      });

      expect(screen.getByTestId('no-session')).toBeInTheDocument();
      expect(screen.getByTestId('is-manager')).toHaveTextContent('false');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
      expect(screen.getByTestId('has-user-role')).toHaveTextContent('false');
    });

    it('should handle authenticated user with USER role', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        prefs: { role: 'USER' },
        labels: ['user'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      });

      expect(screen.getByTestId('user-role')).toHaveTextContent('USER');
      expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
      expect(screen.getByTestId('has-session')).toBeInTheDocument();
      expect(screen.getByTestId('is-manager')).toHaveTextContent('false');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
      expect(screen.getByTestId('has-user-role')).toHaveTextContent('true');
      expect(screen.getByTestId('has-manager-role')).toHaveTextContent('false');
      expect(screen.getByTestId('has-admin-role')).toHaveTextContent('false');
    });

    it('should handle authenticated user with MANAGER role', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Jane Manager',
        email: 'jane@example.com',
        prefs: { role: 'MANAGER' },
        labels: ['manager'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Jane Manager');
      });

      expect(screen.getByTestId('user-role')).toHaveTextContent('MANAGER');
      expect(screen.getByTestId('is-manager')).toHaveTextContent('true');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
      expect(screen.getByTestId('has-user-role')).toHaveTextContent('true'); // Managers have USER role too
      expect(screen.getByTestId('has-manager-role')).toHaveTextContent('true');
      expect(screen.getByTestId('has-admin-role')).toHaveTextContent('false');
    });

    it('should handle authenticated user with ADMIN role', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Admin User',
        email: 'admin@example.com',
        prefs: { role: 'ADMIN' },
        labels: ['admin'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Admin User');
      });

      expect(screen.getByTestId('user-role')).toHaveTextContent('ADMIN');
      expect(screen.getByTestId('is-manager')).toHaveTextContent('true'); // Admins are managers
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
      expect(screen.getByTestId('has-user-role')).toHaveTextContent('true'); // Admins have all roles
      expect(screen.getByTestId('has-manager-role')).toHaveTextContent('true');
      expect(screen.getByTestId('has-admin-role')).toHaveTextContent('true');
    });

    it('should extract role from labels when prefs not available', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Label Manager',
        email: 'label@example.com',
        prefs: {},
        labels: ['manager'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('MANAGER');
      });

      expect(screen.getByTestId('is-manager')).toHaveTextContent('true');
    });
  });

  describe('Authentication Actions', () => {
    it('should handle OAuth sign-in', async () => {
      mockAccount.get.mockRejectedValue(new Error('Not authenticated'));
      mockAccount.getSession.mockRejectedValue(new Error('No session'));
      mockAccount.createOAuth2Session.mockResolvedValue({});

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('oauth-google')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('oauth-google').click();
      });

      expect(mockAccount.createOAuth2Session).toHaveBeenCalledWith(
        expect.any(String), // OAuth provider
        'http://localhost/auth/callback',
        'http://localhost/auth/error',
        ['email', 'profile']
      );
    });

    it('should handle email sign-in', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        prefs: { role: 'USER' },
        labels: ['user'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);
      mockAccount.createEmailPasswordSession.mockResolvedValue(mockSession);

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('email-signin')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('email-signin').click();
      });

      expect(mockAccount.createEmailPasswordSession).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should handle sign-out', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        prefs: { role: 'USER' },
        labels: ['user'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);
      mockAccount.deleteSession.mockResolvedValue({});

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      });

      await act(async () => {
        screen.getByTestId('signout').click();
      });

      expect(mockAccount.deleteSession).toHaveBeenCalledWith('current');
    });
  });

  describe('Role-Based Components', () => {
    it('should show access denied for insufficient permissions', async () => {
      mockAccount.get.mockRejectedValue(new Error('Not authenticated'));
      mockAccount.getSession.mockRejectedValue(new Error('No session'));

      render(<TestRequireRole />);

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('should show content for sufficient permissions', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Admin User',
        email: 'admin@example.com',
        prefs: { role: 'ADMIN' },
        labels: ['admin'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(<TestRequireRole />);

      await waitFor(() => {
        expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
    });

    it('should show login required for unauthenticated users', async () => {
      mockAccount.get.mockRejectedValue(new Error('Not authenticated'));
      mockAccount.getSession.mockRejectedValue(new Error('No session'));

      render(<TestRequireAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('login-required')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show protected content for authenticated users', async () => {
      const mockUser = {
        $id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        prefs: { role: 'USER' },
        labels: ['user'],
        $createdAt: '2024-01-01T00:00:00Z',
        $updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        $id: 'session123',
        userId: 'user123',
        provider: 'email',
      };

      mockAccount.get.mockResolvedValue(mockUser);
      mockAccount.getSession.mockResolvedValue(mockSession);

      render(<TestRequireAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('login-required')).not.toBeInTheDocument();
    });
  });
});