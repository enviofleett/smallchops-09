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
    
    // Validate customer account has required email field
    if (!customerAccount.email) {
      console.error('❌ Customer account is missing email - blocking access');
      console.error('Customer account details:', {
        id: customerAccount.id,
        user_id: customerAccount.user_id,
        name: customerAccount.name
      });
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Account Configuration Error</h2>
            <p className="text-gray-700 mb-4">
              Your customer account is missing required information (email). 
              Please contact support to resolve this issue.
            </p>
            <p className="text-sm text-gray-500">
              Error Code: MISSING_EMAIL
            </p>
          </div>
        </div>
      );
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