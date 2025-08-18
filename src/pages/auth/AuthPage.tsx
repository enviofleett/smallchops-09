import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuthContext } from '@/components/auth/AuthProvider';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthContext();
  const redirectTo = searchParams.get('redirect') || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  const handleAuthSuccess = () => {
    navigate(redirectTo, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-12">
        <div className="w-full max-w-md">
          <AuthModal
            isOpen={true}
            onClose={() => navigate('/')}
            onSuccess={handleAuthSuccess}
            title="Welcome"
            subtitle="Sign in to your account or create a new one"
          />
        </div>
      </div>
      
      <PublicFooter />
    </div>
  );
};

export default AuthPage;