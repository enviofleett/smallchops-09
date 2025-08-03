import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { handlePostLoginRedirect } from '@/utils/redirect';

const AuthRouter = () => {
  const { isAuthenticated, isLoading, userType, user, customerAccount } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authenticated user - redirect based on type
  if (isAuthenticated) {
    if (userType === 'admin' && user) {
      const redirectPath = handlePostLoginRedirect('admin');
      return <Navigate to={redirectPath} replace />;
    }
    
    if (userType === 'customer' && customerAccount) {
      const redirectPath = handlePostLoginRedirect('customer');
      return <Navigate to={redirectPath} replace />;
    }
  }

  // Unauthenticated users - redirect to public home instead of forcing auth
  return <Navigate to="/home" replace />;
};

export default AuthRouter;