
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './auth/LoginPage';
import { supabase } from '@/integrations/supabase/client';
import CreateFirstAdmin from './auth/CreateFirstAdmin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'staff' | 'dispatch_rider';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdminExists = async () => {
      setIsCheckingAdmin(true);
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (error) {
          throw error;
        }
        
        setAdminExists(count !== null && count > 0);
      } catch (error) {
        console.error("Error checking for admin user:", error);
        // Fail safe: assume an admin exists to prevent the app from getting stuck.
        setAdminExists(true);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminExists();
  }, [isAuthenticated]); // Re-check when auth state changes.

  if (isLoading || isCheckingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (adminExists === false) {
      return <CreateFirstAdmin />;
    }
    return <LoginPage />;
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="text-gray-600 mt-2">You don't have permission to view this page</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
