import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { storeRedirectUrl } from '@/utils/redirect';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'customer';
  fallbackPath?: string;
}

const AuthGuard = ({ 
  children, 
  requiredRole,
  fallbackPath = '/auth'
}: AuthGuardProps) => {
  const location = useLocation();
  const { user: adminUser, isAuthenticated: isAdminAuth, isLoading: adminLoading } = useAuth();
  const { customerAccount, isAuthenticated: isCustomerAuth, isLoading: customerLoading } = useCustomerAuth();

  const isLoading = adminLoading || customerLoading;

  // Store the current URL for redirect after login
  useEffect(() => {
    const shouldStoreRedirect = 
      !isLoading && 
      !isAdminAuth && 
      !isCustomerAuth && 
      location.pathname !== '/auth' && 
      location.pathname !== '/';
    
    if (shouldStoreRedirect) {
      const fullPath = location.pathname + location.search + location.hash;
      storeRedirectUrl(fullPath);
    }
  }, [isLoading, isAdminAuth, isCustomerAuth, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Check specific role requirements
  if (requiredRole === 'admin') {
    if (!isAdminAuth || !adminUser) {
      return <Navigate to={`${fallbackPath}?mode=admin`} state={{ from: location }} replace />;
    }
  }

  if (requiredRole === 'customer') {
    if (!isCustomerAuth || !customerAccount) {
      return <Navigate to={`${fallbackPath}?mode=customer`} state={{ from: location }} replace />;
    }
  }

  // If no specific role required, check for any authentication
  if (!requiredRole) {
    if (!isAdminAuth && !isCustomerAuth) {
      return <Navigate to={fallbackPath} state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
};

export default AuthGuard;