
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useHasPermission } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'staff' | 'dispatch_rider';
  menuKey?: string;
  requiredPermission?: 'view' | 'edit';
  requireAdmin?: boolean;
}

/**
 * Enhanced ProtectedRoute with improved authentication and authorization
 * 
 * Features:
 * - Works with both legacy AuthContext and enhanced useAuthStatus
 * - Guaranteed admin access for toolbuxdev@gmail.com
 * - Proper permission-based access control
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
  
  const hasPermission = useHasPermission(menuKey || '', requiredPermission);

  // Determine loading state from both systems
  const isLoading = authContext.isLoading || authStatus.isLoading;
  
  // Determine authentication state
  const isAuthenticated = authContext.isAuthenticated || authStatus.isAuthenticated;
  
  // Determine user info - prefer authStatus for enhanced features
  const user = authStatus.user || authContext.user;
  const userType = authStatus.userType || authContext.userType;
  const hasAdminPrivileges = authStatus.hasAdminPrivileges || (authContext.user?.role === 'admin');

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

  // If admin is required, check admin privileges
  if (requireAdmin && !hasAdminPrivileges) {
    return <Navigate to="/dashboard" replace />;
  }

  // For admin routes, ensure user is admin type
  if (userType !== 'admin' && (requireAdmin || requiredRole === 'admin')) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Check legacy role-based access
  if (requiredRole && authContext.user?.role) {
    const userRole = authContext.user.role;
    if (userRole !== requiredRole && userRole !== 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check modern permission-based access
  if (menuKey && !hasPermission) {
    // For admin users, show a more specific error
    if (hasAdminPrivileges) {
      console.warn(`Admin user lacks permission for ${menuKey}. This might indicate a permission setup issue.`);
    }
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default ProtectedRoute;
