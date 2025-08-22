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

    const loadCustomerAccount = async (userId: string): Promise<CustomerAccount | null> => {
      try {
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching customer account:', error);
          throw new Error(`Failed to load customer account: ${error.message}`);
        }
        
        console.log('🔍 Customer account data:', data);
        return data;
      } catch (error) {
        console.error('Customer account fetch error:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to load customer account');
      }
    };

    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          console.log('Auth state change:', event, session?.user?.email);
          
          if (session?.user) {
            // Use setTimeout to prevent potential Supabase deadlocks
            setTimeout(async () => {
              if (!mounted) return;
              
              setAuthState(prev => ({ 
                ...prev, 
                user: session.user, 
                session, 
                isLoading: true,
                error: null
              }));

              try {
                // Load customer account with error handling
                const customerAccount = await loadCustomerAccount(session.user.id);
                
                if (mounted) {
                  setAuthState(prev => ({
                    ...prev,
                    customerAccount,
                    isLoading: false,
                    isAuthenticated: true, // Session exists = authenticated
                    error: null
                  }));
                }
              } catch (error) {
                console.error('Failed to load customer account:', error);
                if (mounted) {
                  setAuthState(prev => ({
                    ...prev,
                    customerAccount: null,
                    isLoading: false,
                    isAuthenticated: true, // Still authenticated even if account load fails
                    error: error instanceof Error ? error.message : 'Failed to load account details'
                  }));
                }
              }
            }, 0);
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

        // Check for existing session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Failed to get initial session:', sessionError);
          if (mounted) {
            setAuthState(prev => ({ 
              ...prev, 
              isLoading: false,
              error: 'Failed to initialize authentication'
            }));
          }
          return;
        }
        
        if (!mounted) return;

        if (initialSession?.user) {
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: true,
            error: null
          }));

          try {
            const customerAccount = await loadCustomerAccount(initialSession.user.id);
            
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount,
                isLoading: false,
                isAuthenticated: true, // Session exists = authenticated
                error: null
              }));
            }
          } catch (error) {
            console.error('Failed to load initial customer account:', error);
            if (mounted) {
              setAuthState(prev => ({
                ...prev,
                customerAccount: null,
                isLoading: false,
                isAuthenticated: true, // Still authenticated even if account load fails
                error: error instanceof Error ? error.message : 'Failed to load account details'
              }));
            }
          }
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
  }, []);

  const refreshAccount = async (): Promise<{ success: boolean; error?: string }> => {
    if (!authState.session?.user) {
      return { success: false, error: 'No active session' };
    }
    
    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', authState.session.user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error refreshing customer account:', error);
        setAuthState(prev => ({
          ...prev,
          error: `Failed to refresh account: ${error.message}`
        }));
        return { success: false, error: error.message };
      }

      if (data) {
        setAuthState(prev => ({
          ...prev,
          customerAccount: data,
          isAuthenticated: true,
          error: null
        }));
        return { success: true };
      } else {
        setAuthState(prev => ({
          ...prev,
          customerAccount: null,
          error: 'Account not found'
        }));
        return { success: false, error: 'Account not found' };
      }
    } catch (error) {
      console.error('Error refreshing customer account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh account';
      setAuthState(prev => ({
        ...prev,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = async (): Promise<{ success: boolean; error?: string }> => {
    try {
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
        // Don't fail logout for logging errors
      }

      // Clear cart and shopping data before signing out
      try {
        localStorage.removeItem('restaurant_cart');
        localStorage.removeItem('guest_session');
        localStorage.removeItem('cart_abandonment_tracking');
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
      
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
      if (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      console.error('Logout error:', error);
      return { success: false, error: errorMessage };
    }
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

  const updateCustomerAccount = async (updates: Partial<CustomerAccount>): Promise<{ success: boolean; data?: CustomerAccount; error?: string }> => {
    if (!authState.customerAccount) {
      return { success: false, error: 'No customer account found' };
    }

    try {
      const { data, error } = await supabase
        .from('customer_accounts')
        .update(updates)
        .eq('id', authState.customerAccount.id)
        .select()
        .single();

      if (error) {
        console.error('Update customer account error:', error);
        return { success: false, error: error.message };
      }

      setAuthState(prev => ({
        ...prev,
        customerAccount: data,
      }));

      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update account';
      console.error('Update customer account error:', error);
      return { success: false, error: errorMessage };
    }
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