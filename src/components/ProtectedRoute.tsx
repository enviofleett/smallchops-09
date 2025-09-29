
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'manager' | 'support_officer';
  menuKey?: string;
  requiredPermission?: 'view' | 'edit';
  requireAdmin?: boolean;
}

/**
 * Enhanced ProtectedRoute with role-based access control
 * 
 * Features:
 * - Role-based permission system (super_admin, manager, support_officer)
 * - Guaranteed admin access for toolbuxdev@gmail.com
 * - Menu-based access control
 * - Better loading states and error handling
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole,
  menuKey,
  requiredPermission = 'view',
  requireAdmin = false
}: ProtectedRouteProps) => {
  // Use both auth systems for maximum compatibility
  const authContext = useAuth();
  const authStatus = useAuthStatus();
  const { hasPermission, userRole, canCreateUsers } = useRoleBasedPermissions();

  // Determine loading state from both systems
  const isLoading = authContext.isLoading || authStatus.isLoading;
  
  // Determine authentication state
  const isAuthenticated = authContext.isAuthenticated || authStatus.isAuthenticated;
  
  // Determine user info - prefer authStatus for enhanced features
  const user = authStatus.user || authContext.user;
  const userType = authStatus.userType || authContext.userType;
  const hasAdminPrivileges = authStatus.hasAdminPrivileges;

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle authentication errors gracefully
  if (authStatus.error && !isAuthenticated) {
    console.error('Authentication error:', authStatus.error);
    return <Navigate to="/admin/auth" replace />;
  }

  // Check basic authentication
  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Special case: toolbuxdev@gmail.com always gets admin access
  if (user.email === 'toolbuxdev@gmail.com') {
    return <>{children}</>;
  }

  // Check role-based access
  if (requiredRole && userRole !== requiredRole) {
    // Super admin can access everything, manager can access manager and support officer routes
    if (userRole === 'super_admin') {
      // Super admin can access all routes
    } else if (userRole === 'manager' && requiredRole === 'support_officer') {
      // Manager can access support officer routes
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // If admin is required, check admin privileges (only super_admin has full admin privileges)
  if (requireAdmin && !hasAdminPrivileges) {
    return <Navigate to="/dashboard" replace />;
  }

  // For admin routes, ensure user has admin role
  if (userType !== 'admin' && (requireAdmin || ['super_admin', 'manager', 'support_officer'].includes(requiredRole || ''))) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Check modern menu permission-based access
  if (menuKey && !hasPermission(menuKey, requiredPermission)) {
    // For admin users, show a more specific error
    if (userRole) {
      console.warn(`User with role '${userRole}' lacks permission for ${menuKey}. Redirecting to dashboard.`);
    }
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default ProtectedRoute;
