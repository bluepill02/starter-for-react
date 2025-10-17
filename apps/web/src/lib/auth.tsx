
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Models, OAuthProvider } from 'appwrite';
import { getAccount } from '../appwrite/client';
import { User, UserSchema } from '../../../../packages/schema/src/types';

// Auth context types
interface AuthSession extends Models.Session {
  // Extended session properties can be added here
}

interface AuthContextType {
  currentUser: User | null;
  session: AuthSession | null;
  loading: boolean;
  signInWithOAuth: (provider: 'google' | 'microsoft') => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  isManager: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: 'USER' | 'MANAGER' | 'ADMIN') => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// OAuth provider configurations
const OAUTH_SUCCESS_URL = `${window.location.origin}/auth/callback`;
const OAUTH_FAILURE_URL = `${window.location.origin}/auth/error`;

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const account = getAccount();

  // Extract user role from Appwrite preferences or labels
  const extractUserRole = (appwriteUser: Models.User<Models.Preferences>): 'USER' | 'MANAGER' | 'ADMIN' => {
    // Check preferences first
    const roleFromPrefs = appwriteUser.prefs?.role;
    if (roleFromPrefs && ['USER', 'MANAGER', 'ADMIN'].includes(roleFromPrefs)) {
      return roleFromPrefs as 'USER' | 'MANAGER' | 'ADMIN';
    }

    // Check labels for role assignment
    const labels = appwriteUser.labels || [];
    if (labels.includes('admin')) return 'ADMIN';
    if (labels.includes('manager')) return 'MANAGER';
    
    // Default to USER
    return 'USER';
  };

  // Convert Appwrite user to our User schema
  const mapAppwriteUser = useCallback((appwriteUser: Models.User<Models.Preferences>): User => {
    const role = extractUserRole(appwriteUser);
    
    return {
      $id: appwriteUser.$id,
      name: appwriteUser.name,
      email: appwriteUser.email,
      avatar: appwriteUser.prefs?.avatar,
      role,
      department: appwriteUser.prefs?.department,
      managerId: appwriteUser.prefs?.managerId,
      createdAt: appwriteUser.$createdAt,
      updatedAt: appwriteUser.$updatedAt,
    };
  }, []);

  // Load current user and session
  const loadUser = useCallback(async () => {
    try {
      const [appwriteUser, currentSession] = await Promise.all([
        account.get(),
        account.getSession('current')
      ]);

      const user = mapAppwriteUser(appwriteUser);
      
      // Validate user with schema
      const validatedUser = UserSchema.parse(user);
      
      setCurrentUser(validatedUser);
      setSession(currentSession as AuthSession);
    } catch (error) {
      // User not authenticated or session expired
      setCurrentUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [mapAppwriteUser]);

  // Sign in with OAuth provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'microsoft'): Promise<void> => {
    try {
      // Redirect to OAuth provider
      account.createOAuth2Session(
        provider === 'google' ? OAuthProvider.Google : OAuthProvider.Microsoft,
        OAUTH_SUCCESS_URL,
        OAUTH_FAILURE_URL,
        ['email', 'profile'] // Request email and profile scopes
      );
    } catch (error) {
      console.error('OAuth sign-in error:', error);
      throw new Error(`Failed to sign in with ${provider}. Please try again.`);
    }
  }, [account]);

  // Sign in with email and password
  const signInWithEmail = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      await account.createEmailPasswordSession(email, password);
      await loadUser();
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw new Error('Invalid email or password. Please try again.');
    }
  }, [account, loadUser]);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, name: string): Promise<void> => {
    try {
      await account.create('unique()', email, password, name);
      await signInWithEmail(email, password);
    } catch (error) {
      console.error('Sign-up error:', error);
      throw new Error('Failed to create account. Please try again.');
    }
  }, [account, signInWithEmail]);

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await account.deleteSession('current');
      setCurrentUser(null);
      setSession(null);
    } catch (error) {
      console.error('Sign-out error:', error);
      // Clear local state even if API call fails
      setCurrentUser(null);
      setSession(null);
    }
  }, [account]);

  // RBAC helper: Check if user is manager
  const isManager = useCallback((): boolean => {
    return currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';
  }, [currentUser]);

  // RBAC helper: Check if user is admin
  const isAdmin = useCallback((): boolean => {
    return currentUser?.role === 'ADMIN';
  }, [currentUser]);

  // RBAC helper: Check if user has specific role
  const hasRole = useCallback((role: 'USER' | 'MANAGER' | 'ADMIN'): boolean => {
    if (!currentUser) return false;
    
    // Admin has all roles
    if (currentUser.role === 'ADMIN') return true;
    
    // Manager has MANAGER and USER roles
    if (currentUser.role === 'MANAGER' && (role === 'MANAGER' || role === 'USER')) return true;
    
    // User only has USER role
    return currentUser.role === role;
  }, [currentUser]);

  // Refresh user data
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!currentUser) return;
    
    try {
      const appwriteUser = await account.get();
      const user = mapAppwriteUser(appwriteUser);
      const validatedUser = UserSchema.parse(user);
      setCurrentUser(validatedUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [account, currentUser, mapAppwriteUser]);

  // Initialize auth state on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId');
      const secret = urlParams.get('secret');
      
      if (userId && secret) {
        try {
          // OAuth callback successful, load user data
          await loadUser();
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('OAuth callback error:', error);
        }
      }
    };

    if (window.location.pathname === '/auth/callback') {
      handleOAuthCallback();
    }
  }, [loadUser]);

  const contextValue: AuthContextType = {
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
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Higher-order component for role-based protection
interface RequireRoleProps {
  role: 'USER' | 'MANAGER' | 'ADMIN';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps): React.ReactElement | null {
  const { hasRole, loading } = useAuth();
  
  if (loading) {
    return <div className="animate-spin">Loading...</div>;
  }
  
  if (!hasRole(role)) {
    return <>{fallback || <div>Access denied. Insufficient permissions.</div>}</>;
  }
  
  return <>{children}</>;
}

// Higher-order component for authentication protection
interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAuth({ children, fallback }: RequireAuthProps): React.ReactElement | null {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="animate-spin">Loading...</div>;
  }
  
  if (!currentUser) {
    return <>{fallback || <div>Please sign in to access this content.</div>}</>;
  }
  
  return <>{children}</>;
}