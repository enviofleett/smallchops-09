
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

const ProtectedRoute = ({ 
  children, 
  requiredRole,
  menuKey,
  requiredPermission = 'view'
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const hasPermission = useHasPermission(menuKey || '', requiredPermission);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
