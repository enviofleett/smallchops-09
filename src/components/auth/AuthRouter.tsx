import React, { useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { handlePostLoginRedirect } from '@/utils/redirect';
import { useNavigationThrottle } from '@/utils/navigationThrottle';

const AuthRouter = () => {
  const { isAuthenticated, isLoading, userType, user, customerAccount } = useAuth();
  const { shouldNavigate } = useNavigationThrottle();
  const hasNavigated = useRef(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authenticated user - redirect based on type (with throttling)
  if (isAuthenticated && !hasNavigated.current) {
    if (userType === 'admin' && user) {
      const redirectPath = handlePostLoginRedirect('admin');
      if (shouldNavigate(redirectPath)) {
        hasNavigated.current = true;
        return <Navigate to={redirectPath} replace />;
      }
    }
    
    if (userType === 'customer' && customerAccount) {
      const redirectPath = handlePostLoginRedirect('customer');
      if (shouldNavigate(redirectPath)) {
        hasNavigated.current = true;
        return <Navigate to={redirectPath} replace />;
      }
    }
  }

  // Unauthenticated users - redirect to public store at root (with throttling)
  if (!isAuthenticated && !hasNavigated.current && shouldNavigate('/')) {
    hasNavigated.current = true;
    return <Navigate to="/" replace />;
  }

  // If navigation was throttled, show loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

export default AuthRouter;