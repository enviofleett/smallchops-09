import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { handlePostLoginRedirect } from '@/utils/redirect';

const AuthRouter = () => {
  const { isAuthenticated, isLoading, userType, user } = useUnifiedAuth();

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
    
    if (userType === 'customer') {
      const redirectPath = handlePostLoginRedirect('customer');
      return <Navigate to={redirectPath} replace />;
    }
  }

  // Unauthenticated users - redirect to public store at root
  return <Navigate to="/" replace />;
};

export default AuthRouter;