import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { storeRedirectUrl } from '@/utils/redirect';

interface CustomerRouteGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

const CustomerRouteGuard = ({ 
  children, 
  fallbackPath = '/auth?mode=customer'
}: CustomerRouteGuardProps) => {
  const location = useLocation();
  const { customerAccount, isAuthenticated, isLoading, userType } = useAuth();

  // Store the current URL for redirect after login
  useEffect(() => {
    const shouldStoreRedirect = 
      !isLoading && 
      !isAuthenticated && 
      location.pathname !== '/auth' && 
      location.pathname !== '/';
    
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

  // Redirect to customer auth if not authenticated, wrong user type, or no customer account
  if (!isAuthenticated || userType !== 'customer' || !customerAccount) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default CustomerRouteGuard;