
import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { storeRedirectUrl } from '@/utils/redirect';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'manager' | 'support_officer' | 'admin';
  menuKey?: string;
  requiredPermission?: 'view' | 'edit';
  requireAdmin?: boolean;
}

/**
 * Enhanced ProtectedRoute with unified authentication system
 * 
 * Features:
 * - Unified authentication checking
 * - Role-based permission system
 * - Menu-based access control
 * - Production-ready security
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole,
  menuKey,
  requiredPermission = 'view',
  requireAdmin = false
}: ProtectedRouteProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    canAccessAdmin,
    hasRole,
    hasMenuPermission 
  } = useUnifiedAuth();

  // PRODUCTION SECURITY: Store redirect URL for seamless post-login navigation
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location.pathname !== '/admin/auth' && location.pathname !== '/auth') {
      const fullPath = location.pathname + location.search + location.hash;
      storeRedirectUrl(fullPath);
    }
  }, [isLoading, isAuthenticated, location]);

  // PRODUCTION SECURITY: Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // PRODUCTION SECURITY: Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin/auth" state={{ from: location }} replace />;
  }

  // PRODUCTION SECURITY: Check admin access using unified auth
  if (!canAccessAdmin) {
    return <Navigate to="/admin/auth" replace />;
  }

  // PRODUCTION SECURITY: Role-based access control
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // PRODUCTION SECURITY: Menu-based permission checking for granular control
  if (menuKey && !hasMenuPermission(menuKey, requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed - render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
