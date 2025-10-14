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

    // 🚫 CRITICAL: Don't run customer auth on admin routes to prevent session conflicts
    const isAdminRoute = window.location.pathname.startsWith('/admin') || 
                         window.location.pathname === '/dashboard';
    
    if (isAdminRoute) {
      console.log('⏭️ Skipping customer auth on admin route:', window.location.pathname);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const loadCustomerAccount = async (userId: string) => {
      try {
        console.log('🔍 useCustomerAuth: Loading customer account for userId:', userId);
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error fetching customer account:', error);
          return null;
        }
        
        if (data) {
          console.log('✅ Customer account loaded:', {
            id: data.id,
            name: data.name,
            email: data.email
          });
        } else {
          console.warn('⚠️ No customer account found for userId:', userId);
        }
        
        return data;
      } catch (error) {
        console.error('❌ Customer account fetch error:', error);
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        console.log('🔍 useCustomerAuth: Initializing auth...');
        
        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔍 useCustomerAuth: Auth state changed:', event, {
            hasSession: !!session,
            userEmail: session?.user?.email
          });
          
          if (!mounted) return;
          
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

              // Load customer account
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
        console.log('🔍 useCustomerAuth: Checking for existing session...');
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          console.log('✅ useCustomerAuth: Found existing session for:', initialSession.user.email);
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: true 
          }));

          const customerAccount = await loadCustomerAccount(initialSession.user.id);
          
          if (mounted) {
            console.log('✅ useCustomerAuth: Auth state fully initialized', {
              hasUser: true,
              hasCustomerAccount: !!customerAccount,
              customerEmail: customerAccount?.email
            });
            setAuthState(prev => ({
              ...prev,
              customerAccount,
              isLoading: false,
              isAuthenticated: true, // Session exists = authenticated
              error: null
            }));
          }
        } else {
          console.log('⚠️ useCustomerAuth: No existing session found');
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