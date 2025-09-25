import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// Optimized customer auth hook with React Query integration
export const useOptimizedCustomerAuth = () => {
  const [authState, setAuthState] = useState<CustomerAuthState>({
    user: null,
    session: null,
    customerAccount: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const queryClient = useQueryClient();

  // React Query for customer account - prevents duplicate API calls
  const { 
    data: customerAccount, 
    isLoading: isLoadingAccount,
    error: accountError 
  } = useQuery({
    queryKey: ['customer-account', authState.user?.id],
    queryFn: async () => {
      if (!authState.user?.id) return null;
      
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', authState.user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching customer account:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!authState.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - account data doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Prevent excessive refetches
    retry: 1 // Single retry on failure
  });

  // Update auth state when customer account data changes
  useEffect(() => {
    setAuthState(prev => ({
      ...prev,
      customerAccount,
      isLoading: prev.isLoading && isLoadingAccount,
      error: accountError?.message || null
    }));
  }, [customerAccount, isLoadingAccount, accountError]);

  useEffect(() => {
    let mounted = true;
    let subscription: any;

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          if (session?.user) {
            setAuthState(prev => ({ 
              ...prev, 
              user: session.user, 
              session, 
              isLoading: false, // Let React Query handle account loading
              isAuthenticated: true,
              error: null
            }));
          } else {
            setAuthState({
              user: null,
              session: null,
              customerAccount: null,
              isLoading: false,
              isAuthenticated: false,
              error: null,
            });
            
            // Clear customer account query when logging out
            queryClient.removeQueries({ queryKey: ['customer-account'] });
          }
        });

        subscription = data.subscription;

        // Check for existing session (single call)
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: false, // Let React Query handle account loading
            isAuthenticated: true,
            error: null
          }));
        } else {
          if (mounted) {
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Customer auth initialization error:', error);
        if (mounted) {
          setAuthState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication initialization failed'
          }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [queryClient]);

  // Optimized refresh function using React Query
  const refreshAccount = useCallback(async () => {
    if (!authState.session?.user) return;
    
    try {
      await queryClient.invalidateQueries({ 
        queryKey: ['customer-account', authState.session.user.id] 
      });
    } catch (error) {
      console.error('Error refreshing customer account:', error);
    }
  }, [authState.session?.user, queryClient]);

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
    
    // Clear React Query cache
    queryClient.clear();
    
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

    // Update React Query cache
    queryClient.setQueryData(['customer-account', authState.user?.id], data);

    return data;
  };

  return {
    ...authState,
    isLoading: authState.isLoading || isLoadingAccount,
    logout,
    updateCustomerAccount,
    refetch: refreshAccount,
    secureRegister,
    secureVerifyOTP,
  };
};