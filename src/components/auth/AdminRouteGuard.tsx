import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { storeRedirectUrl } from '@/utils/redirect';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'staff' | 'dispatch_rider';
  fallbackPath?: string;
}

const AdminRouteGuard = ({ 
  children, 
  requiredRole,
  fallbackPath = '/auth?mode=admin'
}: AdminRouteGuardProps) => {
  const location = useLocation();
  const { user, userType, isAuthenticated, isLoading } = useAuth();

  // Store the current URL for redirect after login
  useEffect(() => {
    const shouldStoreRedirect = 
      !isLoading && 
      !isAuthenticated && 
      location.pathname !== '/auth' && 
      location.pathname !== '/login';
    
    if (shouldStoreRedirect) {
      const fullPath = location.pathname + location.search + location.hash;
      storeRedirectUrl(fullPath);
    }
  }, [isLoading, isAuthenticated, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user is authenticated as admin
  if (!isAuthenticated || userType !== 'admin' || !user) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check specific role requirements
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRouteGuard;