import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

  // Enhanced session validation and refresh
  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...');
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      if (data.session) {
        setAuthState(prev => ({
          ...prev,
          session: data.session,
          user: data.user,
          error: null
        }));
        console.log('✅ Session refreshed successfully');
      }
      return data.session;
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Session refresh failed'
      }));
      return null;
    }
  };

  const signOut = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('restaurant_cart');
      localStorage.removeItem('guest_session');
      localStorage.removeItem('cart_abandonment_tracking');
      
      // Clear React Query cache if available
      try {
        const queryClient = (window as any)?.queryClient;
        if (queryClient && typeof queryClient.clear === 'function') {
          queryClient.clear();
        }
      } catch {
        console.log('Query client not available for clearing');
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setAuthState({
        user: null,
        session: null,
        customerAccount: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sign out failed'
      }));
    }
  };

  // Simplified customer account creation with better error handling
  const createCustomerAccount = async (userId: string, userEmail: string) => {
    try {
      console.log('🔄 Creating customer account for:', { userId, userEmail });
      
      // Validate inputs
      if (!userId || !userEmail) {
        throw new Error('User ID and email are required');
      }
      
      const { data, error } = await supabase
        .from('customer_accounts')
        .insert({
          user_id: userId,
          email: userEmail.toLowerCase(),
          name: userEmail.split('@')[0], // Basic name from email
          email_verified: true
        })
        .select()
        .single();

      if (error) {
        // Handle specific database errors
        if (error.code === '23505') { // unique_violation
          console.log('ℹ️ Customer account already exists, fetching existing account');
          return await loadCustomerAccount(userId, userEmail);
        }
        console.error('❌ Failed to create customer account:', error);
        return null;
      }

      console.log('✅ Customer account created successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error creating customer account:', error);
      return null;
    }
  };

  const loadCustomerAccount = async (userId: string, userEmail?: string) => {
      try {
        console.log('🔍 Loading customer account for user:', { userId, userEmail });
        
        const { data, error } = await supabase
          .from('customer_accounts')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error fetching customer account:', error);
          
          // If account not found, try to create one if we have user data
          if (error.code === 'PGRST116' && userEmail) {
            console.log('🔄 Customer account not found, attempting to create one...');
            return await createCustomerAccount(userId, userEmail);
          }
          return null;
        }
        
        if (!data && userEmail) {
          console.log('🔄 No customer account found, creating new one...');
          return await createCustomerAccount(userId, userEmail);
        }
        
        console.log('✅ Customer account loaded:', data);
        return data;
      } catch (error) {
        console.error('❌ Customer account fetch error:', error);
        
        // Fallback: Try to create account if we have email
        if (userEmail) {
          console.log('🔄 Fallback: Attempting to create customer account...');
          return await createCustomerAccount(userId, userEmail);
        }
        return null;
      }
    };

  useEffect(() => {
    let mounted = true;
    let subscription: any;

    const initializeAuth = async () => {
      try {
        // Enhanced auth state listener with session validation
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          console.log(`🔄 Enhanced auth state change: ${event}`, { 
            hasUser: !!session?.user, 
            email: session?.user?.email,
            sessionValid: !!session?.access_token,
            timestamp: new Date().toISOString()
          });
          
          if (session?.user) {
            try {
              // Validate session before processing
              if (!session.access_token) {
                console.warn('⚠️ Session missing access token, attempting refresh...');
                const refreshedSession = await refreshSession();
                if (!refreshedSession) {
                  throw new Error('Unable to refresh session');
                }
                session = refreshedSession;
              }

              // Atomic loading state update
              setAuthState(prev => ({ 
                ...prev, 
                user: session.user, 
                session, 
                isLoading: true,
                error: null
              }));

              // Load customer account with enhanced error handling
              const customerAccount = await loadCustomerAccount(session.user.id, session.user.email);
              
              if (!mounted) return;
              
              // Complete auth state update with validation
              const authUpdate = {
                user: session.user,
                session,
                customerAccount,
                isLoading: false,
                isAuthenticated: !!customerAccount && !!session.access_token,
                error: customerAccount ? null : `Customer profile not found for ${session.user.email}. Please contact support if this persists.`
              };
              
              console.log('✅ Enhanced auth state update complete:', { 
                hasAccount: !!customerAccount, 
                isAuthenticated: authUpdate.isAuthenticated, 
                sessionValid: !!session.access_token,
                userId: session.user.id,
                email: session.user.email,
                timestamp: new Date().toISOString()
              });
              
              setAuthState(authUpdate);
            } catch (error) {
              console.error('❌ Enhanced auth state change error:', error);
              if (mounted) {
                setAuthState(prev => ({
                  ...prev,
                  customerAccount: null,
                  isLoading: false,
                  isAuthenticated: false,
                  error: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }));
              }
            }
          } else {
            // Clear state when no session with cleanup
            console.log('🔄 Clearing auth state - no session');
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
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          console.log('🔄 Initial session detected:', initialSession.user.email);
          
          setAuthState(prev => ({ 
            ...prev, 
            user: initialSession.user, 
            session: initialSession, 
            isLoading: true 
          }));

          const customerAccount = await loadCustomerAccount(initialSession.user.id, initialSession.user.email);
          
          if (mounted) {
            const isAuthenticated = !!customerAccount;
            const error = customerAccount ? null : 'Unable to load customer profile. Please try refreshing the page.';
            
            console.log('🔄 Initial customer account load result:', { 
              hasAccount: !!customerAccount, 
              isAuthenticated, 
              userId: initialSession.user.id,
              email: initialSession.user.email 
            });
            
            setAuthState(prev => ({
              ...prev,
              customerAccount,
              isLoading: false,
              isAuthenticated,
              error
            }));
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

  const refreshAccount = async () => {
    if (!authState.session?.user) {
      console.log('🔄 Refresh attempted but no session found');
      return;
    }
    
    console.log('🔄 Refreshing customer account for:', authState.session.user.email);
    
    try {
      const customerAccount = await loadCustomerAccount(
        authState.session.user.id, 
        authState.session.user.email
      );
      
      if (customerAccount) {
        console.log('✅ Account refresh successful');
        setAuthState(prev => ({
          ...prev,
          customerAccount,
          isAuthenticated: true,
          error: null
        }));
      } else {
        console.log('❌ Account refresh failed - no account found/created');
        setAuthState(prev => ({
          ...prev,
          customerAccount: null,
          isAuthenticated: false,
          error: 'Unable to load customer profile. Please contact support.'
        }));
      }
    } catch (error) {
      console.error('❌ Error refreshing customer account:', error);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to refresh account. Please try again.'
      }));
    }
  };

  const logout = async () => {
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
    logout: signOut,
    updateCustomerAccount,
    refetch: refreshAccount,
    refreshSession,
  };
};