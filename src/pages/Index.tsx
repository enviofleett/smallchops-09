
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { handlePostLoginRedirect } from '@/utils/redirect';
import Dashboard from './Dashboard';

const Index = () => {
  const { isAuthenticated: isAdminAuth, isLoading: adminLoading, user: adminUser } = useAuth();
  const { isAuthenticated: isCustomerAuth, isLoading: customerLoading, customerAccount } = useCustomerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for both auth systems to load
    if (adminLoading || customerLoading) return;

    // If admin is authenticated, show dashboard
    if (isAdminAuth && adminUser) {
      return; // Stay on dashboard
    }

    // If customer is authenticated, redirect to customer portal
    if (isCustomerAuth && customerAccount) {
      const redirectPath = handlePostLoginRedirect('customer');
      navigate(redirectPath);
      return;
    }

    // If no one is authenticated, go to auth page
    navigate('/auth');
  }, [isAdminAuth, isCustomerAuth, adminLoading, customerLoading, adminUser, customerAccount, navigate]);

  const isLoading = adminLoading || customerLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only show admin dashboard if admin is authenticated
  if (isAdminAuth && adminUser) {
    return <Dashboard />;
  }

  // Redirect will happen in useEffect
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;
