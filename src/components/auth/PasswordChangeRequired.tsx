import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface PasswordChangeRequiredProps {
  children: React.ReactNode;
}

export function PasswordChangeRequired({ children }: PasswordChangeRequiredProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Query to check if password change is required with aggressive caching
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['password-change-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('must_change_password, created_with_temp_password')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking password status:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id && isAuthenticated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - don't refetch
    gcTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
    refetchOnMount: false,     // Don't refetch on every route change
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });

  useEffect(() => {
    // Don't redirect if already on password change page
    if (location.pathname === '/admin/change-password') {
      return;
    }

    // Wait for all data to load
    if (authLoading || profileLoading) {
      return;
    }

    // Check if password change is required
    if (isAuthenticated && profile?.must_change_password) {
      navigate('/admin/change-password', { replace: true });
    }
  }, [isAuthenticated, profile, authLoading, profileLoading, navigate, location.pathname]);

  // Show loading state
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
