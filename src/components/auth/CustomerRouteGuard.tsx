import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
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
  const { customerAccount, isAuthenticated, isLoading, error } = useCustomerAuth();

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

  // Check for authentication errors
  if (error) {
    console.warn('Customer authentication error:', error);
  }

  // Redirect to customer auth if not authenticated or no customer account
  if (!isAuthenticated || !customerAccount) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default CustomerRouteGuard;