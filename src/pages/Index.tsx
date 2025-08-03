
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';
import CustomerPortal from './CustomerPortal';

const Index = () => {
  const { isAuthenticated, isLoading, userType, user, customerAccount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // If admin is authenticated, show dashboard
    if (isAuthenticated && userType === 'admin' && user) {
      return; // Stay on dashboard
    }

    // If customer is authenticated, stay on root page (will show customer portal)
    if (isAuthenticated && userType === 'customer' && customerAccount) {
      return; // Stay on root - will show customer portal content
    }

    // If no one is authenticated, redirect to public home
    navigate('/home');
  }, [isAuthenticated, isLoading, userType, user, customerAccount, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-sm">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show admin dashboard if admin is authenticated
  if (isAuthenticated && userType === 'admin' && user) {
    return <Dashboard />;
  }

  // Show customer portal if customer is authenticated
  if (isAuthenticated && userType === 'customer' && customerAccount) {
    return <CustomerPortal />;
  }

  // Redirect will happen in useEffect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground text-sm">Redirecting...</p>
      </div>
    </div>
  );
};

export default Index;
