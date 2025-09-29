import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { AuthAuditLogger } from '@/utils/authAuditLogger';

interface AuthStatusResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SupabaseUser | null;
  userRole: string | null;
  userType: 'admin' | 'customer' | null;
  hasAdminPrivileges: boolean;
  error: Error | null;
}

export const useAuthStatus = (): AuthStatusResult => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userType, setUserType] = useState<'admin' | 'customer' | null>(null);
  const [hasAdminPrivileges, setHasAdminPrivileges] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      setError(null);
      
      // Special handling for toolbuxdev@gmail.com - guaranteed admin privileges
      if (authUser.email === 'toolbuxdev@gmail.com') {
        setUserRole('admin');
        setUserType('admin');
        setHasAdminPrivileges(true);
        
        // Log toolbux admin access
        await AuthAuditLogger.logToolbuxAccess('profile_load', { 
          guaranteed_admin: true,
          timestamp: new Date().toISOString() 
        });
        
        return;
      }

      // Check admin profile first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active, name')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Profile fetch error:', profileError);
      }

      if (profile && profile.role === 'admin' && profile.is_active) {
        setUserRole(profile.role);
        setUserType('admin');
        setHasAdminPrivileges(true);
        return;
      }

      // Check customer account
      const { data: customerAccount, error: customerError } = await supabase
        .from('customer_accounts')
        .select('id, name')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (customerError) {
        console.warn('Customer account fetch error:', customerError);
      }

      if (customerAccount) {
        setUserRole('customer');
        setUserType('customer');
        setHasAdminPrivileges(false);
        return;
      }

      // Default fallback - no role found
      setUserRole(null);
      setUserType(null);
      setHasAdminPrivileges(false);

    } catch (err) {
      console.error('Error loading user profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to load user profile'));
      setUserRole(null);
      setUserType(null);
      setHasAdminPrivileges(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session
    const checkSession = async () => {
      try {
        setError(null);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) return;

        if (session?.user) {
          setIsAuthenticated(true);
          setUser(session.user);
          await loadUserProfile(session.user);
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setUserRole(null);
          setUserType(null);
          setHasAdminPrivileges(false);
        }
      } catch (err) {
        console.error('Session check error:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Session check failed'));
          setIsAuthenticated(false);
          setUser(null);
          setUserRole(null);
          setUserType(null);
          setHasAdminPrivileges(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        try {
          setError(null);
          
          if (session?.user) {
            setIsAuthenticated(true);
            setUser(session.user);
            await loadUserProfile(session.user);
          } else {
            setIsAuthenticated(false);
            setUser(null);
            setUserRole(null);
            setUserType(null);
            setHasAdminPrivileges(false);
          }
        } catch (err) {
          console.error('Auth state change error:', err);
          if (mounted) {
            setError(err instanceof Error ? err : new Error('Auth state change failed'));
          }
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { 
    isAuthenticated, 
    isLoading, 
    user, 
    userRole, 
    userType, 
    hasAdminPrivileges, 
    error 
  };
};