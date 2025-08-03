
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'staff' | 'dispatch_rider';
  menuKey?: string;
  requiredPermission?: 'view' | 'edit';
}

/**
 * @deprecated Use AdminRouteGuard for admin routes and CustomerRouteGuard for customer routes instead.
 * This component is kept for backward compatibility but will be removed in future versions.
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole,
  menuKey,
  requiredPermission = 'view'
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, userType, isLoading } = useAuth();
  const hasPermission = useHasPermission(menuKey || '', requiredPermission);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Strict separation: Only allow admin users for protected routes
  if (!isAuthenticated || userType !== 'admin' || !user) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Check role-based access (legacy)
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Check permission-based access (new system)
  if (menuKey && !hasPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
