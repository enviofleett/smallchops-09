import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { handlePostLoginRedirect } from '@/utils/redirect';

const AuthRouter = () => {
  const { isAuthenticated: isAdminAuth, isLoading: adminLoading, user: adminUser } = useAuth();
  const { isAuthenticated: isCustomerAuth, isLoading: customerLoading, customerAccount } = useCustomerAuth();

  const isLoading = adminLoading || customerLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Admin user - redirect to dashboard
  if (isAdminAuth && adminUser) {
    const redirectPath = handlePostLoginRedirect('admin');
    return <Navigate to={redirectPath} replace />;
  }

  // Customer user - redirect to their last page or home
  if (isCustomerAuth && customerAccount) {
    const redirectPath = handlePostLoginRedirect('customer');
    return <Navigate to={redirectPath} replace />;
  }

  // No authentication - redirect to auth page
  return <Navigate to="/auth" replace />;
};

export default AuthRouter;