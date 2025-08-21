import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SecurityMonitor } from '@/lib/security-utils';

interface CustomerAccount {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  date_of_birth?: string;
  email?: string;
}

interface CustomerAuthState {
  user: User | null;
  session: Session | null;
  customerAccount: CustomerAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export const useCustomerAuth = () => {
  const [authState, setAuthState] = useState<CustomerAuthState>({
    user: null,
    session: null,
    customerAccount: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let subscription: any;
    let accountFetchTimeout: NodeJS.Timeout;

    // Fast customer account loader with timeout
    const loadCustomerAccount = async (userId: string, timeoutMs: number = 3000) => {
      return Promise.race([
        supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        new Promise<{ data: null; error: Error }>((_, reject) => 
          setTimeout(() => reject(new Error('Account fetch timeout')), timeoutMs)
        )
      ]).then(({ data, error }) => {
        if (error && !error.message.includes('timeout')) {
          console.warn('Error fetching customer account:', error);
        }
        return data;
      }).catch(() => null);
    };

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          if (session?.user) {
            // Immediately mark as authenticated to unblock UI
            setAuthState(prev => ({ 
              ...prev, 
              user: session.user, 
              session, 
              isLoading: false, // Unblock UI immediately
              isAuthenticated: true,
              error: null
            }));

            // Load customer account in background
            const customerAccount = await loadCustomerAccount(session.user.id, 2000);
            
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount,
                error: null
              }));
            }
          } else {
            setAuthState({
              user: null,
              session: null,
              customerAccount: null,
              isLoading: false,
              isAuthenticated: false,
              error: null,
            });
          }
        });

        subscription = data.subscription;

        // Fast initial session check with timeout
        const sessionPromise = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) => 
            setTimeout(() => resolve({ data: { session: null } }), 1000)
          )
        ]);

        const { data: { session: initialSession } } = await sessionPromise;
        
        if (!mounted) return;

        if (initialSession?.user) {
          // Immediate UI unblock for authenticated users
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: false, // Unblock UI immediately
            isAuthenticated: true,
            error: null
          }));

          // Background customer account fetch
          accountFetchTimeout = setTimeout(async () => {
            if (!mounted) return;
            const customerAccount = await loadCustomerAccount(initialSession.user.id, 1500);
            
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount,
                error: null
              }));
            }
          }, 0);
        } else {
          // Fast-path for guest users
          setAuthState(prev => ({ 
            ...prev, 
            isLoading: false,
            isAuthenticated: false 
          }));
        }
      } catch (error) {
        console.warn('Customer auth initialization error:', error);
        if (mounted) {
          // Don't block UI on auth errors
          setAuthState(prev => ({ 
            ...prev, 
            isLoading: false,
            isAuthenticated: false,
            error: error instanceof Error ? error.message : 'Authentication initialization failed'
          }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      if (accountFetchTimeout) clearTimeout(accountFetchTimeout);
    };
  }, []);

  const refreshAccount = async () => {
    if (!authState.session?.user) return;
    
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', authState.session.user.id)
        .maybeSingle();
      
      if (!error && data) {
        setAuthState(prev => ({
          ...prev,
          customerAccount: data,
          isAuthenticated: true,
          error: null
        }));
      }
    } catch (error) {
      console.error('Error refreshing customer account:', error);
    }
  };

  const logout = async () => {
    // Log security event for logout
    try {
      await SecurityMonitor.logEvent(
        'customer_logout',
        'low',
        'Customer logged out successfully',
        {
          customer_id: authState.customerAccount?.id,
          email: authState.customerAccount?.email,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error('Failed to log logout event:', error);
    }

    // Clear cart and shopping data before signing out
    localStorage.removeItem('restaurant_cart');
    localStorage.removeItem('guest_session');
    localStorage.removeItem('cart_abandonment_tracking');
    
    // Clear React Query cache (if available)
    try {
      const queryClient = (window as any)?.queryClient;
      if (queryClient && typeof queryClient.clear === 'function') {
        queryClient.clear();
      }
    } catch (error) {
      console.log('Query client not available for clearing');
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Secure customer registration function
  const secureRegister = async (email: string, password: string, name: string, phone?: string) => {
    try {
      const result = await SecurityMonitor.secureCustomerAuth('register', {
        email,
        password,
        name,
        phone
      });

      if (result.success) {
        // Log successful registration
        await SecurityMonitor.logEvent(
          'customer_registration_success',
          'low',
          'Customer registered successfully via secure auth',
          {
            customer_id: result.customer_id,
            email: email
          }
        );
      }

      return result;
    } catch (error) {
      console.error('Secure registration error:', error);
      await SecurityMonitor.logEvent(
        'customer_registration_error',
        'medium',
        'Customer registration failed with exception',
        {
          email: email,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
      
      return {
        success: false,
        error: 'Registration failed. Please try again.'
      };
    }
  };

  // Secure OTP verification function
  const secureVerifyOTP = async (email: string, otpCode: string) => {
    try {
      const result = await SecurityMonitor.secureCustomerAuth('verify_otp', {
        email,
        otpCode
      });

      if (result.success) {
        await SecurityMonitor.logEvent(
          'customer_otp_verification_success',
          'low',
          'Customer OTP verified successfully',
          {
            customer_id: result.customer_id,
            email: email
          }
        );
      }

      return result;
    } catch (error) {
      console.error('Secure OTP verification error:', error);
      await SecurityMonitor.logEvent(
        'customer_otp_verification_error',
        'medium',
        'Customer OTP verification failed with exception',
        {
          email: email,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return {
        success: false,
        error: 'OTP verification failed. Please try again.'
      };
    }
  };

  const updateCustomerAccount = async (updates: Partial<CustomerAccount>) => {
    if (!authState.customerAccount) return;

    const { data, error } = await supabase
      .from('customer_accounts')
      .update(updates)
      .eq('id', authState.customerAccount.id)
      .select()
      .single();

    if (error) throw error;

    setAuthState(prev => ({
      ...prev,
      customerAccount: data,
    }));

    return data;
  };

  return {
    ...authState,
    logout,
    updateCustomerAccount,
    refetch: refreshAccount,
    secureRegister,
    secureVerifyOTP,
  };
};